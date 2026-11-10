<?php
// Generic loans-desk rules, ported from ADMIN_V1 (../admin_v2/ADMIN_V1):
//   main/trans/functions.php  loan_toy, check_member, check_toy, get_due, rent, overdue,
//                             reserves_array, check_in_array, fill_array
//   main/trans/loans/loans.php (generic "too many toys" check)
//   class/member.php          data_from_table, loan_type_count, weight_count
//   class/toy.php             data_from_table, get_next_reservation
// Library-specific subdomain rules (loans/<library>_loans.php, lp_custom) are NOT
// ported: those libraries keep settings.mem_self_checkout = 'No' (research R2).
// Self-service never applies the desk's staff "override".

require_once __DIR__ . '/db.php';

// Plain-language refusal messages (FR-023); none names another member.
const REFUSAL_MESSAGES = [
    'NOT_FOUND' => "We couldn't find a toy with that ID. Check the label and try again.",
    'ALREADY_YOURS' => 'You already have this toy on loan.',
    'ON_LOAN' => 'This toy is already on loan. Please see a volunteer.',
    'HELD' => 'This toy is being held for someone else. Please see a volunteer.',
    'RESERVATION_TOY' => 'Reservation toys cannot be borrowed through self-checkout. Please see a volunteer.',
    'RESERVED' => 'This toy is reserved for someone else. Please see a volunteer.',
    'NOT_IN_CIRCULATION' => "This toy can't be borrowed right now. Please see a volunteer.",
    'QUARANTINE' => "This toy is resting after its last loan and can't be borrowed yet. Please see a volunteer.",
    'STOCKTAKE' => "This toy is locked for stocktake and can't be borrowed right now. Please see a volunteer.",
    'LIMIT_REACHED' => "You've reached your borrowing limit. Return a toy first, or see a volunteer.",
    'GOLD_STAR_LIMIT' => "You've reached your limit for Gold Star toys. Please see a volunteer.",
    'MEMBER_INACTIVE' => "Your membership isn't active, so you can't borrow right now. Please see a volunteer.",
    'MEMBERSHIP_EXPIRED' => 'Your membership has expired, so you can\'t borrow right now. Please see a volunteer to renew.',
];

function refusal_message(string $code): string {
    return REFUSAL_MESSAGES[$code] ?? 'This action is not available. Please see a volunteer.';
}

// Every setting the ported rules read, by name only.
function desk_settings(PDO $pdo): array {
    static $s = null;
    if ($s !== null) return $s;
    $names = ['loanperiod', 'reservations', 'reserve_fee', 'toy_holds', 'stocktake_override',
        'loan_weighting', 'chargerent', 'global_rent', 'check_toys', 'unlock_returns', 'quarantine',
        'q_days', 'toy_loan_period', 'ignore_toy_loanperiod', 'loanperiod_mem', 'holiday_override',
        'holiday_due', 'rentasfine', 'rent_factor', 'fine_value', 'fine_factor', 'grace',
        'roundup_week', 'rounddown_week', 'daily_fine', 'max_daily_fine', 'max_fine_per_toy',
        'recordfine'];
    $s = [];
    foreach ($names as $n) $s[$n] = get_setting($pdo, $n);
    return $s;
}

function yes(string $v): bool { return strcasecmp(trim($v), 'Yes') === 0; }
function num($v): float { return is_numeric($v) ? (float) $v : 0.0; }

// Desk "long name" (Member::data_from_table), used for transaction.borname and journal.name.
function member_long_name(array $r): string {
    $f = trim((string) $r['firstname']); $s = trim((string) $r['surname']);
    $f2 = trim((string) ($r['firstname2'] ?? '')); $s2 = trim((string) ($r['surname2'] ?? ''));
    if ($f2 !== '' && $s === $s2) return "$f and $f2 $s";
    if ($f2 !== '') return "$f $s and $f2 $s2";
    return "$f $s";
}

function load_member(PDO $pdo, int $borid): ?array {
    $stmt = $pdo->prepare(
        "SELECT b.id, b.firstname, b.surname, b.partnersname AS firstname2, b.partnerssurname AS surname2,
                b.pin, trim(b.member_status) AS member_status, b.expired, b.phone2,
                coalesce(m.maxnoitems, 0) AS maxnoitems, coalesce(m.returnperiod, 0) AS returnperiod,
                coalesce(m.gold_star, 0) AS gold_star, m.free_rent,
                (SELECT count(*) FROM public.transaction t WHERE t.borid = b.id AND t.return IS NULL) AS toys_onloan,
                (SELECT coalesce(sum(c.weight), 0) FROM public.transaction t
                   LEFT JOIN public.toys ty ON ty.idcat = t.idcat
                   LEFT JOIN public.category c ON c.category = ty.category
                  WHERE t.borid = b.id AND t.return IS NULL) AS weight_loans,
                (SELECT count(*) FROM public.transaction t LEFT JOIN public.toys ty ON t.idcat = ty.idcat
                  WHERE t.borid = b.id AND upper(ty.loan_type) = 'GOLD STAR' AND t.return IS NULL) AS gold_star_onloan
           FROM public.borwrs b
           LEFT JOIN public.membertype m ON m.membertype = b.membertype
          WHERE b.id = ?");
    $stmt->execute([$borid]);
    $m = $stmt->fetch();
    if (!$m) return null;
    $m['longname'] = member_long_name($m);
    return $m;
}

// Toy::data_from_table. $forUpdate locks the toys row (borrow transaction, FR-014).
function load_toy(PDO $pdo, string $idcat, bool $forUpdate = false): ?array {
    $idcat = strtoupper(trim($idcat));
    if ($idcat === '') return null;
    if ($forUpdate) {
        $pdo->prepare('SELECT 1 FROM public.toys WHERE upper(idcat) = ? FOR UPDATE')->execute([$idcat]);
    }
    $stmt = $pdo->prepare(
        "SELECT toys.idcat, toys.toyname, toys.alert, toys.toy_status, toys.stocktake_status,
                coalesce(toys.returndateperiod, 0) AS loanperiod, toys.reservecode, toys.loan_type,
                coalesce(c.weight, 1) AS weight, coalesce(toys.rent, 0) AS rent,
                coalesce(t.loans, 0) AS loans, coalesce(t.borid, 0) AS onloan_borid,
                coalesce(h.borid, 0) AS hold_borid, h.id AS holdid,
                q.date_end AS q_lock
           FROM public.toys
           LEFT JOIN (SELECT borid, idcat, id FROM public.toy_holds
                       WHERE status IN ('ACTIVE', 'READY', 'PENDING') AND upper(idcat) = :i1
                       ORDER BY id LIMIT 1) h ON upper(h.idcat) = upper(toys.idcat)
           LEFT JOIN (SELECT count(id) AS loans, idcat, max(borid) AS borid FROM public.transaction
                       WHERE return IS NULL AND upper(idcat) = :i2 GROUP BY idcat) t ON upper(t.idcat) = upper(toys.idcat)
           LEFT JOIN public.category c ON c.category = toys.category
           LEFT JOIN (SELECT max(date_end) AS date_end, idcat FROM public.toy_holds
                       WHERE status = 'LOCKED' AND upper(idcat) = :i3 GROUP BY idcat) q ON upper(q.idcat) = upper(toys.idcat)
          WHERE upper(toys.idcat) = :i4
          ORDER BY toys.id LIMIT 1");
    $stmt->execute(['i1' => $idcat, 'i2' => $idcat, 'i3' => $idcat, 'i4' => $idcat]);
    $t = $stmt->fetch();
    return $t ?: null;
}

// Earliest ACTIVE reservation for the toy (Toy::get_next_reservation).
function next_reservation(PDO $pdo, string $idcat): ?array {
    $stmt = $pdo->prepare("SELECT id AS rid, member_id AS borid, date_start, date_end,
                                  (date_end - current_date) AS days_left
                             FROM public.reserve_toy
                            WHERE status = 'ACTIVE' AND upper(idcat) = ?
                            ORDER BY date_start LIMIT 1");
    $stmt->execute([strtoupper($idcat)]);
    return $stmt->fetch() ?: null;
}

// Is any day in [today, today + $lp) reserved by another member? (reserves_array + check_in_array)
function reserved_by_others(PDO $pdo, string $idcat, int $lp, int $borid): bool {
    $stmt = $pdo->prepare("SELECT date_start, (date_end::date - date_start) AS days
                             FROM public.reserve_toy
                            WHERE upper(idcat) = ? AND date_end >= current_date AND member_id <> ? AND status = 'ACTIVE'");
    $stmt->execute([strtoupper($idcat), $borid]);
    $taken = [];
    foreach ($stmt as $r) {
        $start = new DateTime($r['date_start']);
        for ($i = 0; $i < (int) $r['days'] + 1; $i++) {
            $taken[(clone $start)->modify("+$i day")->format('Y-m-d')] = true;
        }
    }
    $today = new DateTime('today');
    for ($i = 0; $i < $lp; $i++) {
        if (isset($taken[(clone $today)->modify("+$i day")->format('Y-m-d')])) return true;
    }
    return false;
}

// Desk loan_toy checks in the desk's order. Returns ['code' => null|CODE, 'reservation' => ?array].
function borrow_check(PDO $pdo, array $m, ?array $t, array $s): array {
    $res = null;
    if (!$m) return ['code' => 'MEMBER_INACTIVE'];
    if ($t && $t['q_lock'] !== null) return ['code' => 'QUARANTINE'];
    if ($m['member_status'] !== 'ACTIVE') return ['code' => 'MEMBER_INACTIVE'];
    // Stricter than the desk (research R12): no staff member is present to judge.
    if ($m['expired'] !== null && $m['expired'] < date('Y-m-d')) return ['code' => 'MEMBERSHIP_EXPIRED'];
    if (!$t) return ['code' => 'NOT_FOUND'];
    if ((int) $m['gold_star'] > 0 && strtoupper((string) $t['loan_type']) === 'GOLD STAR'
        && (int) $m['gold_star_onloan'] >= (int) $m['gold_star']) {
        return ['code' => 'GOLD_STAR_LIMIT'];
    }
    if ((int) $t['onloan_borid'] !== 0 || (int) $t['loans'] > 0) {
        return ['code' => (int) $t['onloan_borid'] === (int) $m['id'] ? 'ALREADY_YOURS' : 'ON_LOAN'];
    }
    if ($t['reservecode'] !== null && $t['reservecode'] !== '') {
        return ['code' => 'RESERVATION_TOY'];
    }
    if (trim((string) $t['toy_status']) !== 'ACTIVE') {
        return ['code' => 'NOT_IN_CIRCULATION'];
    }
    if (trim((string) $t['stocktake_status']) === 'LOCKED' && !yes($s['stocktake_override'])) {
        return ['code' => 'STOCKTAKE'];
    }
    if (yes($s['toy_holds']) && (int) $t['hold_borid'] > 0 && (int) $t['hold_borid'] !== (int) $m['id']) {
        return ['code' => 'HELD'];
    }
    if (yes($s['reservations'])) {
        $next = next_reservation($pdo, $t['idcat']);
        $lp = (int) num($s['loanperiod']);
        if ((int) $t['loanperiod'] > 0) $lp = (int) $t['loanperiod'];
        if (trim((string) $t['reservecode']) !== '') {
            if ($next && (int) $next['days_left'] <= $lp) $lp = (int) $next['days_left'];
            if (reserved_by_others($pdo, $t['idcat'], $lp, (int) $m['id'])) return ['code' => 'RESERVED'];
            if ($next && (int) $next['borid'] === (int) $m['id']) $res = $next;
        }
    }
    // loans.php: (toys on loan [or weighted total] + this toy's weight) > membertype.maxnoitems
    $onloan = yes($s['loan_weighting']) ? num($m['weight_loans']) : (int) $m['toys_onloan'];
    if ($onloan + num($t['weight']) > (int) $m['maxnoitems']) return ['code' => 'LIMIT_REACHED'];
    return ['code' => null, 'reservation' => $res];
}

// get_due() without subdomain branches. Returns Y-m-d.
function due_date(array $m, array $t, array $s): string {
    $lp = (int) num($s['loanperiod']);
    $tlp = (int) $t['loanperiod'];
    $mlp = (int) $m['returnperiod'];
    $holiday = yes($s['holiday_override']);
    $reserveCode = trim((string) $t['reservecode']) !== '';
    if (!$reserveCode) {
        if ($tlp < $lp && $tlp !== 0 && strcasecmp($s['ignore_toy_loanperiod'], 'No') === 0) $lp = $tlp;
    } elseif ($tlp !== 0 && $tlp < $lp) {
        $lp = $tlp;
    }
    if (yes($s['toy_loan_period']) && $tlp > 0 && !$holiday) $lp = $tlp;
    if (!$holiday && $mlp !== 0) $lp = $mlp;
    if ($reserveCode && $lp > $tlp && $tlp !== 0) $lp = $tlp;
    if (yes($s['loanperiod_mem']) && $mlp !== 0) $lp = $mlp;
    if ($holiday && trim($s['holiday_due']) !== '') {
        $d = strtotime($s['holiday_due']);
        if ($d !== false) return date('Y-m-d', $d);
    }
    return (new DateTime('today'))->modify("+$lp day")->format('Y-m-d');
}

// rent(): amount to charge on borrow (0 = none).
function rent_amount(array $m, array $t, array $s): float {
    if (!yes($s['chargerent'])) return 0.0;
    $global = num($s['global_rent']);
    if (num($t['rent']) <= 0 && $global <= 0) return 0.0;
    if (yes((string) $m['free_rent'])) return 0.0;
    return $global == 0 ? num($t['rent']) : $global;
}

// overdue(): fine for a return $daysOverdue days late. Returns ['amount' => float, 'weeks' => int].
function overdue_fine(PDO $pdo, array $m, array $t, array $s, int $daysOverdue): array {
    $fine = yes($s['rentasfine'])
        ? (num($s['rent_factor']) > 0 ? num($t['rent']) * num($s['rent_factor']) : num($t['rent']))
        : num($s['fine_value']);
    if (trim($s['fine_factor']) !== '' && trim($s['fine_factor']) !== '0') $fine *= num($s['fine_factor']);
    $grace = (int) num($s['grace']);
    $weeks = (int) round(($daysOverdue - $grace) / 7);
    if (yes($s['roundup_week']) || yes($s['rounddown_week'])) $weeks = (int) ceil(($daysOverdue - $grace) / 7);
    if ($weeks < 0) $weeks = 0;
    $total = round($weeks * $fine, 2);

    if (yes($s['daily_fine'])) {
        $stmt = $pdo->prepare('SELECT count(*) FROM public.transaction WHERE borid = ? AND return = current_date');
        $stmt->execute([$m['id']]);
        if ((int) $stmt->fetchColumn() > 0) $total = 0.0;
    }
    // Desk sets the fine TO max_fine_per_toy (for 2+ weeks); applied here as a cap, its evident intent.
    $maxPerToy = (int) num($s['max_fine_per_toy']);
    if ($weeks > 1 && $maxPerToy !== 0 && $total > $maxPerToy) $total = (float) $maxPerToy;
    // max_daily_fine caps today's total overdue fines for the member (check_daily_limit).
    $maxDaily = num($s['max_daily_fine']);
    if ($maxDaily > 0 && $total > 0) {
        $stmt = $pdo->prepare("SELECT coalesce(sum(amount), 0) FROM public.journal
                                WHERE datepaid = current_date AND category = 'Overdue Fine' AND bcode = ?");
        $stmt->execute([$m['id']]);
        $today = (float) $stmt->fetchColumn();
        if ($today + $total > $maxDaily) $total = max(0.0, round($maxDaily - $today, 2));
    }
    if (strcasecmp($s['recordfine'], 'No') === 0) $total = 0.0;
    return ['amount' => $total, 'weeks' => $weeks];
}
