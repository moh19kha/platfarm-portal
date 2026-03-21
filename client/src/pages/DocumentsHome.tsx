import { Link, useLocation } from "wouter";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030422219/MW4gvkHfHJD9tbPbdFFnda/logo_db87658a.png";

export default function DocumentsHome() {
  const [, navigate] = useLocation();

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#F5F2ED", minHeight: "100vh" }}>
      {/* Top bar */}
      <nav style={{
        height: 56, background: "#1B3A2D", display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 32px", color: "white",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "white",
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>Documents</span>
        </div>
        <button
          onClick={() => navigate("/documents/saved")}
          style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, padding: "6px 16px", color: "white", fontSize: 13,
            fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          View Saved Documents
        </button>
      </nav>

      {/* Main content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1B3A2D", letterSpacing: -0.5, marginBottom: 8 }}>
            Create a Document
          </h1>
          <p style={{ fontSize: 14, color: "#99A09C" }}>
            Select the type of document you want to generate
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {/* Quotation Card */}
          <div
            onClick={() => navigate("/documents/quotation")}
            style={{
              background: "white", borderRadius: 16, padding: "32px 28px", cursor: "pointer",
              border: "1.5px solid rgba(27,58,45,0.08)", transition: "all 0.3s",
              display: "flex", flexDirection: "column", gap: 16,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#1B3A2D";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(27,58,45,0.1)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(27,58,45,0.08)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: "rgba(27,58,45,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" fill="none" stroke="#1B3A2D" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1B3A2D", marginBottom: 6 }}>Quotation</h3>
              <p style={{ fontSize: 13, color: "#5C6360", lineHeight: 1.5 }}>
                Create a professional quotation with itemized products, pricing, and terms.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#C4704B", marginTop: "auto" }}>
              <span>Create Quotation</span>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Invoice Card */}
          <div
            onClick={() => navigate("/documents/invoice")}
            style={{
              background: "white", borderRadius: 16, padding: "32px 28px", cursor: "pointer",
              border: "1.5px solid rgba(27,58,45,0.08)", transition: "all 0.3s",
              display: "flex", flexDirection: "column", gap: 16,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#1B3A2D";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(27,58,45,0.1)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(27,58,45,0.08)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: "rgba(27,58,45,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" fill="none" stroke="#1B3A2D" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1B3A2D", marginBottom: 6 }}>Invoice</h3>
              <p style={{ fontSize: 13, color: "#5C6360", lineHeight: 1.5 }}>
                Generate a professional invoice for completed orders with payment details.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#C4704B", marginTop: "auto" }}>
              <span>Create Invoice</span>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Payment Receipt Card */}
          <div
            onClick={() => navigate("/documents/receipt")}
            style={{
              background: "white", borderRadius: 16, padding: "32px 28px", cursor: "pointer",
              border: "1.5px solid rgba(27,58,45,0.08)", transition: "all 0.3s",
              display: "flex", flexDirection: "column", gap: 16,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#1B3A2D";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(27,58,45,0.1)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(27,58,45,0.08)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: "rgba(27,58,45,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" fill="none" stroke="#1B3A2D" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1B3A2D", marginBottom: 6 }}>Payment Receipt</h3>
              <p style={{ fontSize: 13, color: "#5C6360", lineHeight: 1.5 }}>
                Generate a professional payment receipt as proof of payment received.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#C4704B", marginTop: "auto" }}>
              <span>Create Receipt</span>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
