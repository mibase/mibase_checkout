<?php
// Borrow and return writes, ported from ADMIN_V1 main/trans/functions.php
// loan_toy() / return_toy() / qtoy() (research R2, R3). Each runs in ONE database
// transaction with the toy/loan row locked, so self-service records are the same
// as desk records except for the 'self-checkout' marker (constitution II).

require_once __DIR__ . '/_desk_rules.php';
require_once __DIR__ . '/_photos.php';

const SELF_CHECKOUT_MARK = 'self-checkout';

function insert_journal(PDO $pdo, array $m, array $t, string $category, float $amount): void {
    $id = legacy_allocate_id($pdo, 'journal');
    $pdo->prepare("INSERT INTO public.journal (id, datepaid, bcode, icode, name, description, category, amount, type, typepayment)
                   VALUES (?, now(), ?, ?, ?, ?, ?, ?, 'DR', 'Debit')")
        ->execute([$id, $m['id'], $t['idcat'], $m['longname'], $t['toyname'], $category, $amount]);
}

// Returns ['ok' => true, idcat, name, due, rent_charged] or ['ok' => false, 'code' => CODE].
function borrow_toy(PDO $pdo, int $borid, string $idcat, string $location): array {
    $s = desk_settings($pdo);
    $pdo->beginTransaction();
    try {
        $t = load_toy($pdo, $idcat, true);                 // locks the toys row (FR-014)
        $m = load_member($pdo, $borid);
        $check = borrow_check($pdo, $m, $t, $s);
        if ($check['code'] !== null) {
            $pdo->rollBack();
            return ['ok' => false, 'code' => $check['code']];
        }
        $due = due_date($m, $t, $s);
        $session = date('A');                              // AM / PM in the library timezone

        // Same toy loaned to this member today and already returned: reopen it (desk return_today).
        $stmt = $pdo->prepare('SELECT count(id) FROM public.transaction
                                WHERE date_loan::date = current_date AND idcat = ? AND borid = ?');
        $stmt->execute([$t['idcat'], $m['id']]);
        if ((int) $stmt->fetchColumn() > 0) {
            $pdo->prepare('UPDATE public.transaction SET return = NULL, due = ?
                            WHERE date_loan::date = current_date AND idcat = ? AND borid = ?')
                ->execute([$due, $t['idcat'], $m['id']]);
        } else {
            $id = legacy_allocate_id($pdo, 'transaction');
            $pdo->prepare('INSERT INTO public.transaction (id, idcat, borid, due, borname, item, location, session, phone, loanby, version)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$id, $t['idcat'], $m['id'], $due, $m['longname'], $t['toyname'], $location,
                           $session, $m['phone2'], SELF_CHECKOUT_MARK, 'sc']);
        }
        $pdo->prepare('UPDATE public.borwrs SET location = ? WHERE id = ?')->execute([$location, $m['id']]);

        $rent = rent_amount($m, $t, $s);
        if ($rent > 0) insert_journal($pdo, $m, $t, 'Rent', $rent);

        $res = $check['reservation'] ?? null;               // this member's own reservation
        if ($res) {
            $pdo->prepare("UPDATE public.reserve_toy SET status = 'LOANED' WHERE id = ?")->execute([$res['rid']]);
            $fee = num($s['reserve_fee']);
            if ($fee > 0) insert_journal($pdo, $m, $t, 'Reservation', $fee);
        }
        if ((int) $t['hold_borid'] === (int) $m['id'] && $t['holdid'] !== null) {
            $pdo->prepare('DELETE FROM public.toy_holds WHERE id = ?')->execute([$t['holdid']]);
        }
        $pdo->commit();
        return ['ok' => true, 'idcat' => $t['idcat'], 'name' => $t['toyname'], 'due' => $due,
                'rent_charged' => number_format($rent, 2, '.', '')];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

// The database part of one return, in its own transaction: ports return_toy() +
// qtoy() and records the photo row ($photo from photo_prepare). Does not touch the
// photo file; callers move it into place after their returns commit.
// Returns ['ok' => true, idcat, name, late, fine_charged, message] or ['ok' => false, 'code' => ...].
function return_loan_write(PDO $pdo, array $s, int $borid, ?int $transactionId, string $idcat, array $photo, string $location): array {
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'SELECT id, idcat, borid, due, date_loan, (current_date - due) AS days_overdue
               FROM public.transaction
              WHERE borid = ? AND return IS NULL AND ' . ($transactionId ? 'id = ?' : 'upper(idcat) = ?') . '
              ORDER BY id LIMIT 1 FOR UPDATE');
        $stmt->execute([$borid, $transactionId ?: strtoupper(trim($idcat))]);
        $loan = $stmt->fetch();
        if (!$loan) {
            $pdo->rollBack();
            return ['ok' => false, 'code' => 'NOT_ON_LOAN_TO_YOU'];
        }
        $m = load_member($pdo, $borid);
        $t = load_toy($pdo, $loan['idcat']) ?? ['idcat' => $loan['idcat'], 'toyname' => $loan['idcat'], 'rent' => 0];

        $pdo->prepare('UPDATE public.transaction SET return = now()::date, timetrans = ?, returnby = ?, location = ? WHERE id = ?')
            ->execute([date('H:i:s'), SELF_CHECKOUT_MARK, $location, $loan['id']]);

        if (yes($s['check_toys'])) {
            $pdo->prepare('UPDATE public.toys SET return_transid = ?, return_check = false WHERE idcat = ?')
                ->execute([$loan['id'], $loan['idcat']]);
        } elseif (yes($s['unlock_returns'])) {
            $pdo->prepare("UPDATE public.toys SET location = ?, stocktake_status = 'ACTIVE' WHERE idcat = ?")
                ->execute([$location, $loan['idcat']]);
        } else {
            $pdo->prepare('UPDATE public.toys SET location = ? WHERE idcat = ?')->execute([$location, $loan['idcat']]);
        }
        $pdo->prepare('UPDATE public.borwrs SET location = ? WHERE id = ?')->execute([$location, $borid]);

        // Returned the same day it was loaned: refund today's rent (desk return_today rule).
        $stmt = $pdo->prepare('SELECT count(id) FROM public.transaction WHERE date_loan::date = current_date AND idcat = ? AND borid = ?');
        $stmt->execute([$loan['idcat'], $borid]);
        if ((int) $stmt->fetchColumn() > 0 && yes($s['chargerent']) && num($t['rent']) > 0) {
            $pdo->prepare("DELETE FROM public.journal WHERE datepaid::date = now()::date AND icode = ? AND bcode = ? AND category = 'Rent'")
                ->execute([$loan['idcat'], $borid]);
        }

        $daysOverdue = (int) $loan['days_overdue'];
        $fine = 0.0;
        if ($daysOverdue > 0) {
            $fine = overdue_fine($pdo, $m, $t, $s, $daysOverdue)['amount'];
            if ($fine > 0) insert_journal($pdo, $m, $t, 'Overdue Fine', $fine);
        }

        if (yes($s['quarantine'])) {                       // desk qtoy()
            $pdo->prepare("DELETE FROM public.toy_holds WHERE idcat = ? AND status = 'LOCKED'")->execute([$loan['idcat']]);
            $holdId = legacy_allocate_id($pdo, 'toy_holds');
            $end = (new DateTime('today'))->modify('+' . (int) num($s['q_days']) . ' day')->format('Y-m-d');
            $pdo->prepare("INSERT INTO public.toy_holds (id, date_start, date_end, borid, status, idcat, created, type_hold)
                           VALUES (?, current_date, ?, ?, 'LOCKED', ?, now(), 'Q')")
                ->execute([$holdId, $end, $borid, $loan['idcat']]);
        }

        $pdo->prepare('INSERT INTO public.self_checkout_return_photos (transaction_id, borid, idcat, stored_path, bytes)
                       VALUES (?, ?, ?, ?, ?)')
            ->execute([$loan['id'], $borid, $loan['idcat'], $photo['stored_path'], $photo['bytes']]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    $late = $daysOverdue > 0;
    $message = $late
        ? ($fine > 0
            ? sprintf('This toy was late, so a fine of $%s was added to your account. Please see a volunteer about it.', number_format($fine, 2))
            : 'This toy was returned after its due date. Please see a volunteer about any charge.')
        : 'Thank you!';
    return ['ok' => true, 'idcat' => $loan['idcat'], 'name' => $t['toyname'], 'late' => $late,
            'fine_charged' => number_format($fine, 2, '.', ''), 'message' => $message];
}

// Return one toy on loan to $borid, identified by transaction id or toy ID, with
// its photo. The photo file is only moved into place after the database commit;
// on any failure nothing is recorded and the temp file is removed.
function return_toy_self(PDO $pdo, int $borid, ?int $transactionId, string $idcat, array $photo, string $location): array {
    try {
        $r = return_loan_write($pdo, desk_settings($pdo), $borid, $transactionId, $idcat, $photo, $location);
    } catch (Throwable $e) {
        photo_discard($photo);
        throw $e;
    }
    if (!$r['ok']) {
        photo_discard($photo);
        return $r;
    }
    photo_commit($photo);
    return $r;
}

// Return All (FR-016a): one photo of all the toys together. Each loan is checked
// and recorded in its own transaction, so one that can't be returned (e.g. it was
// returned at the desk meanwhile) doesn't stop the others. Every returned loan gets
// its own photo row pointing at the same stored file.
// Returns ['returned' => [result...], 'not_returned' => [['transaction_id' => id], ...]].
function return_all_self(PDO $pdo, int $borid, array $transactionIds, array $photo, string $location): array {
    $s = desk_settings($pdo);
    $returned = [];
    $notReturned = [];
    foreach ($transactionIds as $id) {
        try {
            $r = return_loan_write($pdo, $s, $borid, $id, '', $photo, $location);
        } catch (Throwable $e) {
            error_log("return_all_self: transaction $id: " . $e->getMessage());
            $r = ['ok' => false];
        }
        if ($r['ok']) {
            unset($r['ok']);
            $returned[] = $r;
        } else {
            $notReturned[] = ['transaction_id' => $id];
        }
    }
    if (!$returned) {
        photo_discard($photo);
    } else {
        try {
            photo_commit($photo);
        } catch (Throwable $e) {
            // The returns are recorded; only the shared file is missing. Staff see the rows.
            error_log('return_all_self: photo not saved: ' . $e->getMessage());
        }
    }
    return ['returned' => $returned, 'not_returned' => $notReturned];
}
