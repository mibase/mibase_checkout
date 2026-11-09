import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BigButton from "../components/BigButton";
import ConfirmDialog from "../components/ConfirmDialog";
import Message from "../components/Message";
import ReturnPanel from "../components/ReturnPanel";
import ToyResults from "../components/ToyResults";
import { useCheckout } from "../context/CheckoutContext";
import { checkoutApi, newRequestId } from "../lib/checkoutApi";
import { formatDate, formatShortDate } from "../lib/format";

// The one screen after the PIN (spec Screen Layout): member line, message,
// Your Toys with Return / Return All, "Total toys N of M", toy search, Finish.
export default function MyToysPage() {
  const navigate = useNavigate();
  const { firstName, addBorrowed, addReturned, reset } = useCheckout();
  const [loggingOut, setLoggingOut] = useState(false);

  // Log out: end the visit on the server, clear everything in memory and go to
  // the blank start screen (replace, so Back can't show member data).
  async function logout() {
    setLoggingOut(true);
    try {
      await checkoutApi.finish();
    } catch {
      /* the session also expires on its own */
    }
    reset();
    navigate("/", { replace: true });
  }
  const [data, setData] = useState(null); // { loans, member_id, max_items, count }
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState(null); // { tone, title, lines[] }
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [returning, setReturning] = useState(null); // { kind: 'one', item, requestId } | { kind: 'all', loans, requestId }
  const [askClean, setAskClean] = useState(null); // the return waiting for "Have you cleaned it?"
  const messageRef = useRef(null);

  // Before any return, ask whether the toy has been cleaned. Yes goes on to the
  // photo step; Not yet closes the question and asks them to clean it first.
  const startReturn = (r) => setAskClean({ ...r, requestId: newRequestId() });
  const cleanYes = () => {
    setReturning(askClean);
    setAskClean(null);
  };
  const cleanNo = useCallback(() => {
    const all = askClean?.kind === "all";
    setAskClean(null);
    setMessage({
      tone: "info",
      title: all ? "Please clean the toys first" : "Please clean the toy first",
      lines: [`Clean ${all ? "them" : "it"}, then tap Return again. If you need help, please see a volunteer.`],
    });
  }, [askClean]);

  const loadLoans = useCallback(async () => {
    try {
      setData(await checkoutApi.loans());
      setLoadError("");
    } catch (err) {
      if (err.code !== "SESSION_EXPIRED") setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const runSearch = useCallback(async (q) => {
    setSearching(true);
    setSearchError("");
    try {
      const r = await checkoutApi.search(q);
      setResults(r.results);
      setLastQuery(q);
    } catch (err) {
      if (err.code !== "SESSION_EXPIRED") {
        setSearchError(err.message);
        setResults(null);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  function submitSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2 || searching) {
      if (q.length < 2) setSearchError("Type at least 2 letters or numbers of the toy ID or name.");
      return;
    }
    runSearch(q);
  }

  // After every borrow or return: refresh Your Toys, the count and any results
  // (FR-020), and show what happened at the top.
  function done(msg) {
    setMessage(msg);
    setReturning(null);
    loadLoans();
    if (lastQuery) runSearch(lastQuery);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      messageRef.current?.focus();
    }, 0);
  }

  function borrowed(r) {
    addBorrowed({ idcat: r.idcat, name: r.name, due: r.due });
    const lines = [`Due back ${formatDate(r.due)}.`];
    if (Number(r.rent_charged) > 0) lines.push(`A rent charge of $${r.rent_charged} was added to your account.`);
    done({ tone: "success", title: `${r.idcat} ${r.name} has been borrowed.`, lines });
  }

  async function returnOne(photoBlob) {
    const { item, requestId } = returning;
    const r = await checkoutApi.returnToy({
      transactionId: item.transaction_id,
      idcat: item.idcat,
      requestId,
      photoBlob,
    });
    addReturned({ idcat: r.idcat, name: r.name, late: r.late });
    done({
      tone: r.late ? "error" : "success",
      title: `${r.idcat} ${r.name} has been returned.`,
      lines: [r.message],
    });
  }

  async function returnAll(photoBlob) {
    const { loans, requestId } = returning;
    const r = await checkoutApi.returnAll({
      transactionIds: loans.map((l) => l.transaction_id),
      requestId,
      photoBlob,
    });
    r.returned.forEach((x) => addReturned({ idcat: x.idcat, name: x.name, late: x.late }));
    const lines = r.returned.map((x) => `${x.idcat} ${x.name}${x.late ? " (late)" : ""}`);
    if (r.returned.some((x) => x.late)) lines.push("Some toys were late. Please see a volunteer about any charge.");
    if (r.not_returned.length) {
      const names = r.not_returned.map(({ transaction_id }) => {
        const l = loans.find((x) => x.transaction_id === transaction_id);
        return l ? `${l.idcat} ${l.name}` : `Loan ${transaction_id}`;
      });
      lines.push(`Not returned: ${names.join(", ")}. Please see a volunteer.`);
    }
    done({
      tone: r.not_returned.length || r.returned.some((x) => x.late) ? "error" : "success",
      title: `${r.returned.length} ${r.returned.length === 1 ? "toy has" : "toys have"} been returned.`,
      lines,
    });
  }

  if (returning?.kind === "one") {
    return (
      <ReturnPanel title="Return a toy" onConfirm={returnOne} onCancel={() => setReturning(null)}>
        <span className="font-semibold">{returning.item.name}</span> ({returning.item.idcat})
      </ReturnPanel>
    );
  }
  if (returning?.kind === "all") {
    return (
      <ReturnPanel
        title="Return all toys"
        hint="Take one photo showing all the toys together on the returns shelf, just the toys please."
        onConfirm={returnAll}
        onCancel={() => setReturning(null)}
      >
        <ul className="list-disc pl-5">
          {returning.loans.map((l) => (
            <li key={l.transaction_id}>
              {l.idcat} {l.name}
            </li>
          ))}
        </ul>
      </ReturnPanel>
    );
  }

  const loans = data?.loans ?? [];
  return (
    <div className="space-y-6">
      {askClean && (
        <ConfirmDialog
          title={askClean.kind === "all" ? "Have you cleaned the toys?" : "Have you cleaned the toy?"}
          yesLabel={askClean.kind === "all" ? "Yes, they are clean" : "Yes, it is clean"}
          noLabel="Not yet"
          onYes={cleanYes}
          onNo={cleanNo}
        >
          {askClean.kind === "all" ? (
            <p>Please make sure every toy is clean before you return it.</p>
          ) : (
            <p>
              <span className="font-semibold">{askClean.item.name}</span> ({askClean.item.idcat}) needs to be clean
              before you return it.
            </p>
          )}
        </ConfirmDialog>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xl font-bold break-words">
          {data ? `${data.member_id}: ` : ""}
          {firstName}
        </p>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="min-h-11 shrink-0 rounded-lg border-2 border-[var(--border-light)] bg-[var(--surface)] px-4 font-semibold disabled:opacity-50"
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>

      <div ref={messageRef} tabIndex={-1} className="focus:outline-none">
        {message && (
          <Message tone={message.tone} title={message.title}>
            {message.lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </Message>
        )}
      </div>

      <section className="space-y-3" aria-labelledby="your-toys">
        <h1 id="your-toys" className="text-2xl font-bold">
          Your Toys
        </h1>
        {loadError && <Message tone="error">{loadError}</Message>}
        {!data && !loadError && <p className="text-[var(--muted-text)]">Loading your toys…</p>}
        {data && loans.length === 0 && <p className="text-[var(--muted-text)]">You have no toys on loan.</p>}
        {loans.length > 0 && (
          <div className="overflow-hidden rounded-xl border-2 border-[var(--border-light)]">
            <table className="w-full table-fixed border-collapse bg-[var(--surface)] text-left">
              <colgroup>
                <col className="w-[20%]" />
                <col />
                <col className="w-[78px]" />
                <col className="w-[66px]" />
              </colgroup>
              <thead className="bg-[var(--card-background)] text-sm">
                <tr>
                  <th scope="col" className="px-2 py-2 font-semibold">Toy#</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Toyname</th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Return
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">Due</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.transaction_id} className="border-t border-[var(--border-light)] align-top">
                    <td className="px-2 py-3 font-semibold break-words">{l.idcat}</td>
                    <td className="px-2 py-3 break-words">{l.name}</td>
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        onClick={() => startReturn({ kind: "one", item: l })}
                        aria-label={`Return ${l.name}`}
                        className="min-h-11 w-full rounded-lg bg-[var(--primary-cyan)] px-2 font-semibold text-[var(--on-accent)]"
                      >
                        Return
                      </button>
                    </td>
                    <td className="px-2 py-3 text-sm">
                      <span className={l.overdue ? "font-semibold text-[var(--error-text)]" : ""}>
                        {formatShortDate(l.due)}
                      </span>
                      {l.overdue && <span className="block text-xs font-bold text-[var(--error-text)]">Overdue</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              {loans.length >= 2 && (
                <tfoot>
                  <tr className="border-t border-[var(--border-light)] bg-[var(--card-background)]">
                    <td colSpan={2} />
                    <td colSpan={2} className="px-1 py-2">
                      <button
                        type="button"
                        onClick={() => startReturn({ kind: "all", loans })}
                        className="min-h-11 w-full rounded-lg bg-[var(--primary-cyan)] px-2 font-semibold text-[var(--on-accent)]"
                      >
                        Return All
                      </button>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {data && (
          <p className="font-semibold">
            Total toys {data.count} of {data.max_items}
          </p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="search-label">
        <form onSubmit={submitSearch} className="space-y-2">
          <label id="search-label" htmlFor="toy-search" className="block text-lg font-semibold">
            Search for toys to borrow or return
          </label>
          <div className="flex gap-2">
            <input
              id="toy-search"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={60}
              placeholder="Toy ID or name"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchError("");
              }}
              className="min-h-14 min-w-0 flex-1 rounded-xl border-2 border-[var(--border-light)] bg-[var(--surface)] px-4 text-lg text-[var(--text-primary)] focus:border-[var(--primary-cyan)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={searching}
              className="min-h-14 shrink-0 rounded-xl bg-[var(--primary-cyan)] px-5 text-lg font-semibold text-[var(--on-accent)] disabled:opacity-50"
            >
              {searching ? "…" : "Go"}
            </button>
          </div>
        </form>
        {searchError && <Message tone="error">{searchError}</Message>}
        {results && (
          <ToyResults
            results={results}
            onChange={setResults}
            onBorrowed={borrowed}
            onReturn={(item) => startReturn({ kind: "one", item })}
          />
        )}
      </section>

      <BigButton variant="secondary" onClick={() => navigate("/done")}>
        Finish
      </BigButton>
    </div>
  );
}
