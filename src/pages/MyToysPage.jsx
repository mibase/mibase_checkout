import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BigButton from "../components/BigButton";
import Message from "../components/Message";
import ReturnPanel from "../components/ReturnPanel";
import ToyResults from "../components/ToyResults";
import { useCheckout } from "../context/CheckoutContext";
import { checkoutApi, newRequestId } from "../lib/checkoutApi";
import { formatDate } from "../lib/format";

// The one screen after the PIN (spec Screen Layout): member line, message,
// Your Toys with Return / Return All, "Total toys N of M", toy search, Finish.
export default function MyToysPage() {
  const navigate = useNavigate();
  const { firstName, addBorrowed, addReturned } = useCheckout();
  const [data, setData] = useState(null); // { loans, member_id, max_items, count }
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState(null); // { tone, title, lines[] }
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [returning, setReturning] = useState(null); // { kind: 'one', item, requestId } | { kind: 'all', loans, requestId }
  const messageRef = useRef(null);

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
      <p className="text-xl font-bold">
        {data ? `${data.member_id}: ` : ""}
        {firstName}
      </p>

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
          <ul className="space-y-2">
            {loans.map((l) => (
              <li
                key={l.transaction_id}
                className="flex items-center gap-3 rounded-xl border-2 border-[var(--border-light)] bg-[var(--surface)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{l.name}</p>
                  <p className="text-sm text-[var(--muted-text)]">
                    {l.idcat} · due {formatDate(l.due)}
                    {l.overdue && (
                      <span className="ml-2 rounded bg-[var(--error-text)] px-2 py-0.5 text-xs font-bold text-[var(--on-error)]">
                        Overdue
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReturning({ kind: "one", item: l, requestId: newRequestId() })}
                  className="min-h-11 shrink-0 rounded-lg border-2 border-[var(--primary-cyan)] bg-[var(--surface)] px-4 font-semibold"
                >
                  Return
                </button>
              </li>
            ))}
          </ul>
        )}
        {loans.length >= 2 && (
          <BigButton
            variant="secondary"
            onClick={() => setReturning({ kind: "all", loans, requestId: newRequestId() })}
          >
            Return All
          </BigButton>
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
            onReturn={(item) => setReturning({ kind: "one", item, requestId: newRequestId() })}
          />
        )}
      </section>

      <BigButton variant="secondary" onClick={() => navigate("/done")}>
        Finish
      </BigButton>
    </div>
  );
}
