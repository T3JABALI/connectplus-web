export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span className="muted">
        {total === 0 ? 'No results' : `Page ${page} of ${pages} · ${total.toLocaleString('en-KE')} total`}
      </span>
      <div className="btnrow">
        <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function ErrorBox({ message }) {
  return message ? <div className="empty" role="alert" style={{ marginBottom: 12 }}>{message}</div> : null;
}
