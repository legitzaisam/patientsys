import { useState } from "react";
import { Icon } from "../components/Icon";
import { PageHead, PlanTabs } from "../components/Shell";
import { Card, Chip, Head } from "../components/ui";
import { journal, journalFilters, journalMonth } from "../mock/seed";

/** September 2025 grid: 1 Sep is a Monday, 30 days. */
const CAL_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const ENTRY_DAYS = journal.map((e) => e.day);

export function Journal() {
  const [filter, setFilter] = useState("All");
  const entries = filter === "All" ? journal : journal.filter((e) => e.filters.includes(filter));

  return (
    <>
      <PageHead
        title="Your Journal"
        subtitle="Track your progress, stay consistent, and see how far you've come."
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <label style={{ position: "relative", display: "block" }}>
              <Icon
                d="search"
                size={14}
                stroke="var(--ink-3)"
                style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}
              />
              <input className="field" style={{ width: 210, paddingLeft: 32 }} placeholder="Search journal..." />
            </label>
            <button type="button" className="btn btn-primary">
              <Icon d="plus" size={13} /> New entry
            </button>
          </div>
        }
      />
      <PlanTabs />

      <div className="grid" style={{ gridTemplateColumns: "2.05fr 1fr", alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            {journalFilters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="btn btn-ghost btn-sm"
                style={
                  filter === f
                    ? { background: "var(--accent-soft)", boxShadow: "inset 0 0 0 1px var(--accent-line)", fontWeight: 600 }
                    : undefined
                }
              >
                {f}
              </button>
            ))}
          </div>

          <p className="section-title" style={{ margin: "0 0 9px 2px" }}>
            {journalMonth}
          </p>

          <div className="grid" style={{ gap: 10 }}>
            {entries.map((e) => (
              <Card key={e.date} pad={false} style={{ padding: "15px 16px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <p className="tiny num" style={{ width: 74, flex: "none", paddingTop: 1 }}>
                    {e.date}
                  </p>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600 }}>{e.title}</p>
                    {e.body && (
                      <p className="tiny" style={{ marginTop: 4, lineHeight: 1.55, maxWidth: 420 }}>
                        {e.body}
                      </p>
                    )}
                    {e.voice && (
                      <div
                        className="soft-well"
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", marginTop: 8, maxWidth: 290 }}
                      >
                        <span
                          className="tile-icon"
                          style={{ width: 26, height: 26, background: "var(--accent)", color: "var(--accent-ink)" }}
                        >
                          <Icon d="play" size={12} />
                        </span>
                        <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5, height: 16 }}>
                          {Array.from({ length: 34 }, (_, i) => (
                            <span
                              key={i}
                              style={{
                                flex: 1,
                                background: "var(--bar)",
                                borderRadius: 1,
                                height: `${25 + Math.abs(Math.sin(i * 1.7)) * 70}%`,
                              }}
                            />
                          ))}
                        </span>
                        <span className="tiny num">{e.voice.length}</span>
                      </div>
                    )}
                  </div>
                  {e.photos && (
                    <div style={{ display: "flex", gap: 6, flex: "none" }}>
                      {e.photos.map((p) => (
                        <img
                          key={p}
                          src={p}
                          alt=""
                          style={{ width: 68, height: 62, objectFit: "cover", borderRadius: 11 }}
                        />
                      ))}
                    </div>
                  )}
                  {e.tag && (
                    <div style={{ flex: "none", width: 92, textAlign: "right" }}>
                      <Chip tone={e.tag.tone}>
                        <Icon d="tag" size={10} /> {e.tag.label}
                      </Chip>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid">
          <Card>
            <Head title={journalMonth} action={<Icon d="x" size={13} stroke="var(--ink-3)" />} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, textAlign: "center" }}>
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d} className="tiny" style={{ fontSize: 9.5, paddingBottom: 3 }}>
                  {d}
                </span>
              ))}
              {CAL_DAYS.map((d) => {
                const marked = ENTRY_DAYS.includes(d);
                return (
                  <span
                    key={d}
                    className="num"
                    style={{
                      height: 24,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: marked ? 600 : 400,
                      color: marked ? "var(--accent-ink)" : "var(--ink-3)",
                      background: marked ? "var(--accent-soft)" : "transparent",
                      boxShadow: marked ? "inset 0 0 0 1px var(--accent-line)" : "none",
                    }}
                  >
                    {d}
                  </span>
                );
              })}
            </div>
          </Card>

          <Card>
            <Head icon="link" title="Share your journal" />
            <p className="tiny" style={{ lineHeight: 1.5 }}>
              Select what you'd like to share with your clinic or for a second opinion.
            </p>
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 11 }}>
              Create shareable document
            </button>
          </Card>
        </div>
      </div>
    </>
  );
}
