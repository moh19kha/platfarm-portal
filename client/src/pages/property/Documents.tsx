import { trpc } from "@/lib/trpc";
import { formatDate } from "./propUtils";
import { FolderOpen, Upload, Download, Trash2, FileText, Search, Eye, Image, FileSpreadsheet, File } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

function getDocIcon(mimeType?: string | null) {
  if (!mimeType) return <FileText className="h-6 w-6" style={{ color: "#2D5A3D" }} />;
  if (mimeType.includes("pdf")) return <FileText className="h-6 w-6" style={{ color: "#C0714A" }} />;
  if (mimeType.includes("image")) return <Image className="h-6 w-6" style={{ color: "#4A7C59" }} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="h-6 w-6" style={{ color: "#2D5A3D" }} />;
  return <File className="h-6 w-6" style={{ color: "#2D5A3D" }} />;
}

function getDocTypeBadgeColor(type: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    Contract: { bg: "#EEF5EE", text: "#2D5A3D" },
    Receipt: { bg: "#FFF3E0", text: "#E65100" },
    "Floor-Plan": { bg: "#E3F2FD", text: "#1565C0" },
    NOC: { bg: "#F3E5F5", text: "#7B1FA2" },
    "Title-Deed": { bg: "#E8F5E9", text: "#2E7D32" },
    "Payment-Proof": { bg: "#FFF8E1", text: "#F57F17" },
    Correspondence: { bg: "#E0F7FA", text: "#00838F" },
    Photo: { bg: "#FCE4EC", text: "#C62828" },
    Other: { bg: "#F5F5F5", text: "#616161" },
  };
  return colors[type] || colors.Other;
}

export default function Documents() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [propertyFilter, setPropertyFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: properties } = trpc.property.properties.list.useQuery();
  const { data: rawDocs, isLoading, refetch } = trpc.property.documents.all.useQuery({
    propertyId: propertyFilter ? Number(propertyFilter) : undefined,
    documentType: typeFilter || undefined,
    search: search || undefined,
  });

  // Flatten the nested data structure from getAllDocuments
  const docs = useMemo(() => rawDocs?.map((d: any) => {
    // Server returns { doc, propertyName } — "doc" holds the actual document row
    const row = d.doc ?? d;
    return {
      id: row.id,
      documentName: row.fileName ?? row.documentName,
      documentType: row.documentType,
      fileUrl: row.fileUrl,
      mimeType: row.mimeType,
      fileSizeKb: row.fileSizeKb ?? row.fileSize,
      notes: row.notes ?? row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      propertyId: row.propertyId,
      propertyName: d.propertyName,
    };
  }), [rawDocs]);

  const uploadMut = trpc.property.documents.upload.useMutation({
    onSuccess: () => { refetch(); setShowUpload(false); toast.success("Document uploaded"); },
    onError: () => toast.error("Upload failed"),
  });

  const deleteMut = trpc.property.documents.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Document deleted"); },
  });

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const selectStyle = { border: "1px solid #D5D0C8", color: "#2C3E50", background: "#FFFFFF", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>Documents</h1>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>{docs?.length ?? 0} documents across {properties?.length ?? 0} properties</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
            <Upload className="h-4 w-4" /> Upload Document
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} style={selectStyle}>
          <option value="">All Properties</option>
          {properties?.map((p) => <option key={p.id} value={p.id}>{p.propertyName}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          {["Contract", "Receipt", "Floor-Plan", "NOC", "Title-Deed", "Payment-Proof", "Correspondence", "Photo", "Other"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#666666" }} />
          <input type="text" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8", color: "#2C3E50" }} />
        </div>
      </div>

      {/* Document Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse" style={{ border: "1px solid #E8E5E0" }}>
              <div className="h-10 bg-gray-200 rounded mb-3" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : docs && docs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d: any) => {
            const badgeColor = getDocTypeBadgeColor(d.documentType);
            return (
              <div key={d.id} className="bg-white rounded-lg overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md group" style={{ border: "1px solid #E8E5E0" }}>
                <div className="p-4">
                  {/* Header: icon + name + type badge */}
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#F8FAF8" }}>
                      {getDocIcon(d.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate" style={{ color: "#2C3E50" }} title={d.documentName}>
                        {d.documentName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badgeColor.bg, color: badgeColor.text }}>
                          {d.documentType}
                        </span>
                        {d.mimeType && (
                          <span className="text-xs" style={{ color: "#999" }}>
                            {d.mimeType.split("/").pop()?.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Property name */}
                  {d.propertyName && (
                    <p className="text-xs mt-2 truncate" style={{ color: "#4A7C59" }} title={d.propertyName}>
                      {"\uD83D\uDCCD"} {d.propertyName}
                    </p>
                  )}

                  {/* Notes */}
                  {d.notes && (
                    <p className="text-xs mt-1 truncate" style={{ color: "#888" }} title={d.notes}>
                      {d.notes}
                    </p>
                  )}

                  {/* Footer: metadata + actions */}
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #E8E5E0" }}>
                    <div className="flex items-center gap-2">
                      {d.fileSizeKb && (
                        <span className="text-xs font-mono" style={{ color: "#666666" }}>
                          {d.fileSizeKb >= 1024 ? `${(d.fileSizeKb / 1024).toFixed(1)} MB` : `${d.fileSizeKb} KB`}
                        </span>
                      )}
                      {d.createdAt && (
                        <span className="text-xs" style={{ color: "#999" }}>
                          \u00B7 {formatDate(typeof d.createdAt === "string" ? d.createdAt.split("T")[0] : new Date(d.createdAt).toISOString().split("T")[0])}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Preview button for PDFs and images */}
                      {d.fileUrl && (d.mimeType?.includes("pdf") || d.mimeType?.includes("image")) && (
                        <button
                          onClick={() => setPreviewUrl(d.fileUrl)}
                          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" style={{ color: "#4A7C59" }} />
                        </button>
                      )}
                      {/* Download button */}
                      {d.fileUrl && (
                        <button
                          onClick={() => handleDownload(d.fileUrl, d.documentName || "document")}
                          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                          title="Download"
                        >
                          <Download className="h-4 w-4" style={{ color: "#2D5A3D" }} />
                        </button>
                      )}
                      {/* Delete button */}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this document?")) {
                              deleteMut.mutate({ id: d.id });
                            }
                          }}
                          className="p-1.5 rounded hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" style={{ color: "#C0714A" }} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center" style={{ border: "1px solid #E8E5E0" }}>
          <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-20" style={{ color: "#2D5A3D" }} />
          <h3 className="font-semibold text-lg mb-2" style={{ color: "#2C3E50" }}>No documents yet</h3>
          <p className="text-sm mb-6" style={{ color: "#666666" }}>Upload contracts, receipts, and other property documents.</p>
          {isAdmin && (
            <button onClick={() => setShowUpload(true)} className="px-6 py-2.5 rounded-lg text-white text-sm font-medium" style={{ background: "#2D5A3D" }}>
              Upload Document
            </button>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        properties={properties || []}
        onSubmit={(data: any) => uploadMut.mutate(data)}
        isLoading={uploadMut.isPending}
      />

      {/* Preview Dialog */}
      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-4xl h-[80vh]">
            <DialogHeader>
              <DialogTitle>Document Preview</DialogTitle>
            </DialogHeader>
            {previewUrl.match(/\.(png|jpg|jpeg|webp|gif)/i) ? (
              <div className="flex-1 flex items-center justify-center overflow-auto" style={{ height: "calc(80vh - 80px)" }}>
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
              </div>
            ) : (
              <iframe src={previewUrl} className="w-full flex-1 rounded-lg" style={{ height: "calc(80vh - 80px)" }} />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function UploadModal({ open, onClose, properties, onSubmit, isLoading }: any) {
  const [propertyId, setPropertyId] = useState("");
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Contract");
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !propertyId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      onSubmit({
        propertyId: Number(propertyId),
        documentName: docName,
        documentType: docType,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type,
        fileSizeKb: Math.round(file.size / 1024),
        tags: tags ? tags.split(",").map((t: string) => t.trim()) : undefined,
        notes: notes || undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "#2C3E50" }}>Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
            style={{ borderColor: isDragging ? "#4A7C59" : "#D5D0C8", background: isDragging ? "#EEF5EE" : "#F8FAF8" }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm" style={{ color: "#666666" }}>{file ? file.name : "Drag & drop or click to browse"}</p>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Property *</label>
            <select required value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }}>
              <option value="">Select property</option>
              {properties.map((p: any) => <option key={p.id} value={p.id}>{p.propertyName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Document Name *</label>
            <input type="text" required value={docName} onChange={(e) => setDocName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Type *</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }}>
              {["Contract", "Receipt", "Floor-Plan", "NOC", "Title-Deed", "Payment-Proof", "Correspondence", "Photo", "Other"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} placeholder="Optional notes about this document" />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Tags (comma-separated)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} placeholder="e.g., important, 2024" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <button type="submit" disabled={isLoading || !file || !propertyId} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: "#2D5A3D" }}>
              {isLoading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
