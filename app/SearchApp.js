"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";

const PAGE_SIZE = 100;

// Cornell serves photos over HTTP only; route them through our HTTPS proxy to avoid
// mixed-content blocking.
const imgProxy = (u) => (u ? `/api/img?u=${encodeURIComponent(u)}` : "");

export default function SearchApp() {
  const [index, setIndex] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [family, setFamily] = useState("");
  const [status, setStatus] = useState("");
  const [cons, setCons] = useState("");
  const [endemicOnly, setEndemicOnly] = useState(false);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [selected, setSelected] = useState(null); // full species detail object
  const [detailLoading, setDetailLoading] = useState(false);
  const famCache = useRef({});

  useEffect(() => {
    Promise.all([
      fetch("/data/index.json").then((r) => r.json()),
      fetch("/data/meta.json").then((r) => r.json()),
    ])
      .then(([idx, m]) => {
        setIndex(idx);
        setMeta(m);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!index) return [];
    const needle = q.trim().toLowerCase();
    const terms = needle.split(/\s+/).filter(Boolean);
    return index.filter((r) => {
      if (family && r.f !== family) return false;
      if (status && r.st !== status) return false;
      if (cons && r.c !== cons) return false;
      if (endemicOnly && !r.e) return false;
      if (photosOnly && !r.p) return false;
      if (terms.length) {
        const hay = (r.s + " " + r.f + " " + r.g).toLowerCase();
        for (const t of terms) if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [index, q, family, status, cons, endemicOnly, photosOnly]);

  useEffect(() => setLimit(PAGE_SIZE), [q, family, status, cons, endemicOnly, photosOnly]);

  const openDetail = useCallback(
    async (rec) => {
      if (!meta) return;
      setDetailLoading(true);
      setSelected({ _loading: true, _rec: rec });
      try {
        const slug = meta.family_slugs[rec.f];
        if (!famCache.current[slug]) {
          famCache.current[slug] = await fetch(`/data/families/${slug}.json`).then((r) => r.json());
        }
        const fam = famCache.current[slug];
        let found = null;
        for (const g of fam.genera) {
          for (const sp of g.species) {
            if (sp.u === rec.u) {
              found = { ...sp, _family: fam.family, _familyUrl: fam.url };
              break;
            }
          }
          if (found) break;
        }
        setSelected(found || { _notfound: true });
      } catch (e) {
        setSelected({ _error: String(e) });
      } finally {
        setDetailLoading(false);
      }
    },
    [meta]
  );

  const exportFiltered = useCallback((rows) => {
    const headers = ["scientific_name", "family", "genus", "status", "conservation", "endemic", "has_photos", "distribution"];
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([r.s, r.f, r.g, r.st, r.c, r.e ? "yes" : "no", r.p ? "yes" : "no", r.d].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "philippine-plants-filtered.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (error)
    return (
      <div className="container">
        <p style={{ color: "var(--red)" }}>Failed to load data: {error}</p>
      </div>
    );

  const t = meta?.totals;

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <h1>Flora of the Philippines</h1>
          <p>
            A searchable database of Philippine vascular plants — taxonomy, distribution,
            conservation status, and photos.
          </p>
          {t && (
            <div className="stats">
              <div className="stat">
                <b>{t.species.toLocaleString()}</b>
                <span>species</span>
              </div>
              <div className="stat">
                <b>{t.genera.toLocaleString()}</b>
                <span>genera</span>
              </div>
              <div className="stat">
                <b>{t.families.toLocaleString()}</b>
                <span>families</span>
              </div>
              <div className="stat">
                <b>{t.species_with_photos.toLocaleString()}</b>
                <span>with photos</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="container">
        {!index ? (
          <p className="loading">Loading 10,000+ species…</p>
        ) : (
          <>
            <div className="controls">
              <input
                type="text"
                placeholder="Search species, genus, or family…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              <select value={family} onChange={(e) => setFamily(e.target.value)}>
                <option value="">All families</option>
                {meta.families.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any status</option>
                {meta.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={cons} onChange={(e) => setCons(e.target.value)}>
                <option value="">Any conservation status</option>
                {meta.conservations.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="toggles">
              <label>
                <input
                  type="checkbox"
                  checked={endemicOnly}
                  onChange={(e) => setEndemicOnly(e.target.checked)}
                />
                Endemic only
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={photosOnly}
                  onChange={(e) => setPhotosOnly(e.target.checked)}
                />
                With photos only
              </label>
              <span className="resultcount">
                {filtered.length.toLocaleString()} result
                {filtered.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="exportbar">
              <span className="exportlabel">Export to CSV (opens as a table in Excel / Sheets):</span>
              <a className="exbtn primary" href="/data/exports/philippine-plants.csv" download>
                ⬇ All {t ? t.species.toLocaleString() : ""} species
              </a>
              <button className="exbtn" onClick={() => exportFiltered(filtered)}>
                ⬇ Current {filtered.length.toLocaleString()} results
              </button>
            </div>

            <div className="list">
              {filtered.slice(0, limit).map((r) => (
                <div key={r.u} className="row" onClick={() => openDetail(r)}>
                  {r.th ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      className="rowthumb"
                      src={imgProxy(r.th)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="rowthumb placeholder">🌿</span>
                  )}
                  <div className="rowmain">
                    <div className="rowtop">
                      <span className="sci">{r.s}</span>
                      <span className="meta">
                        {r.f} · {r.g}
                      </span>
                    </div>
                    {r.d ? <div className="rowdist">{r.d}</div> : null}
                    <div className="rowbadges">
                      {r.e ? <span className="badge endemic">Endemic</span> : null}
                      {r.c ? <span className="badge cons">{r.c}</span> : null}
                      {r.st && r.st !== "Native" ? (
                        <span className="badge">{r.st}</span>
                      ) : null}
                      {r.p ? <span className="badge photo">Photos</span> : null}
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="more">No species match your search.</p>
              )}
              {filtered.length > limit && (
                <div className="more">
                  Showing {limit.toLocaleString()} of {filtered.length.toLocaleString()}.{" "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setLimit((l) => l + 200);
                    }}
                  >
                    Show more
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selected && (
        <DetailPanel
          data={selected}
          loading={detailLoading}
          onClose={() => setSelected(null)}
        />
      )}

      <footer className="footer">
        Data from{" "}
        <a href="https://www.philippineplants.org/" target="_blank" rel="noreferrer">
          Co&apos;s Digital Flora of the Philippines
        </a>{" "}
        (Pelser, Barcelona &amp; Nickrent, eds., 2011 onwards). Photos © their respective
        contributors, served by the Cornell University herbarium. This is an unofficial
        search interface.
      </footer>
    </>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function DetailPanel({ data, loading, onClose }) {
  const sp = data;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>
          ✕ Close
        </button>

        {loading || sp._loading ? (
          <p className="loading">Loading details…</p>
        ) : sp._error ? (
          <p style={{ color: "var(--red)" }}>Error: {sp._error}</p>
        ) : sp._notfound ? (
          <p>Record not found.</p>
        ) : (
          <>
            <h2>{sp.scientific_name}</h2>
            <div className="author">
              {sp._family}
              {sp.category ? ` · ${sp.category}` : ""}
            </div>
            <div className="badges">
              {sp.status && <span className="badge">{sp.status.replace(/\.$/, "")}</span>}
              {sp.conservation_status && (
                <span className="badge cons">
                  {sp.conservation_status.split("(")[0].trim().replace(/\.$/, "")}
                </span>
              )}
              {sp.dao_category && (
                <span className="badge endemic">DAO: {sp.dao_category.replace(/\.$/, "")}</span>
              )}
            </div>

            {sp.thumbs && sp.thumbs.length > 0 && (
              <div className="thumbs">
                {sp.thumbs.map((thumb, i) => (
                  <a
                    key={i}
                    href={imgProxy((sp.full && sp.full[i]) || thumb)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgProxy(thumb)}
                      alt={sp.scientific_name}
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            )}

            <Field label="Citation / Synonymy" value={sp.citation} />
            <Field label="Distribution" value={sp.distribution} />
            <Field label="Notes" value={sp.notes} />
            <Field label="Conservation status" value={sp.conservation_status} />
            <Field label="DAO category" value={sp.dao_category} />
            {sp.other_fields &&
              Object.entries(sp.other_fields).map(([k, v]) => (
                <Field key={k} label={k} value={v} />
              ))}

            <div className="src">
              {sp.gallery_url && (
                <>
                  <a href={sp.gallery_url} target="_blank" rel="noreferrer">
                    View full photo gallery at Cornell herbarium →
                  </a>
                  <br />
                </>
              )}
              {sp._familyUrl && (
                <a href={sp._familyUrl} target="_blank" rel="noreferrer">
                  View this family on philippineplants.org →
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
