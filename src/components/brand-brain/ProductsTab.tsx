import { useState } from "react";
import { Plus, Building2, Archive, Check, Edit2, Tag, DollarSign, Users, AlertCircle } from "lucide-react";
import { BrandProduct } from "../../types";

interface ProductsTabProps {
  products: BrandProduct[];
  canEdit: boolean;
  onSaveProduct: (product: Partial<BrandProduct>) => Promise<void>;
  onToggleArchive: (productId: string) => Promise<void>;
}

export function ProductsTab({ products, canEdit, onSaveProduct, onToggleArchive }: ProductsTabProps) {
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<BrandProduct> | null>(null);
  const [saving, setSaving] = useState(false);
  const [featureInput, setFeatureInput] = useState("");

  const filteredProducts = products.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const handleOpenCreate = () => {
    setCurrentProduct({
      name: "",
      category: "Software",
      valueProposition: "",
      keyFeatures: [],
      targetAudience: "",
      pricingSummary: "",
      status: "active"
    });
    setFeatureInput("");
    setIsEditing(true);
  };

  const handleOpenEdit = (p: BrandProduct) => {
    setCurrentProduct({ ...p });
    setFeatureInput("");
    setIsEditing(true);
  };

  const handleAddFeature = () => {
    if (!featureInput.trim() || !currentProduct) return;
    const currentFeatures = currentProduct.keyFeatures || [];
    setCurrentProduct({
      ...currentProduct,
      keyFeatures: [...currentFeatures, featureInput.trim()]
    });
    setFeatureInput("");
  };

  const handleRemoveFeature = (idx: number) => {
    if (!currentProduct) return;
    const currentFeatures = currentProduct.keyFeatures || [];
    setCurrentProduct({
      ...currentProduct,
      keyFeatures: currentFeatures.filter((_, i) => i !== idx)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct || !currentProduct.name) return;
    setSaving(true);
    try {
      await onSaveProduct(currentProduct);
      setIsEditing(false);
      setCurrentProduct(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Products & Offerings</h2>
          <p className="text-xs text-neutral-500">
            Define your core products, features, pricing models, and target market segments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-neutral-100 p-1 rounded-lg text-xs font-medium text-neutral-600">
            <button
              onClick={() => setFilter("active")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "active" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              Active ({products.filter((p) => p.status === "active").length})
            </button>
            <button
              onClick={() => setFilter("archived")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "archived" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              Archived ({products.filter((p) => p.status === "archived").length})
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "all" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              All
            </button>
          </div>

          {canEdit && (
            <button
              id="btn-add-product"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            id={`product-card-${product.id}`}
            className={`bg-white rounded-xl border p-5 shadow-xs transition-all flex flex-col justify-between ${
              product.status === "archived" ? "border-neutral-200 opacity-60 bg-neutral-50/50" : "border-neutral-200/80 hover:border-neutral-300"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm leading-snug">{product.name}</h3>
                    <span className="text-[11px] font-medium text-neutral-500">{product.category}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {product.status === "archived" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                      Archived
                    </span>
                  )}
                  {canEdit && (
                    <>
                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title="Edit Product"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggleArchive(product.id)}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title={product.status === "active" ? "Archive Product" : "Restore Product"}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-100/80">
                {product.valueProposition || "No value proposition set."}
              </p>

              {/* Key Features */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Key Features</span>
                <div className="flex flex-wrap gap-1">
                  {product.keyFeatures && product.keyFeatures.length > 0 ? (
                    product.keyFeatures.map((feat, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-700">
                        <Tag className="w-2.5 h-2.5 text-neutral-400" />
                        {feat}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-neutral-400 italic">No features defined</span>
                  )}
                </div>
              </div>

              {/* Audience & Pricing Meta */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase">Target Audience</span>
                  <p className="text-neutral-700 font-medium truncate flex items-center gap-1 mt-0.5">
                    <Users className="w-3 h-3 text-neutral-400 shrink-0" />
                    {product.targetAudience || "General"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase">Pricing Tier</span>
                  <p className="text-neutral-700 font-medium truncate flex items-center gap-1 mt-0.5">
                    <DollarSign className="w-3 h-3 text-neutral-400 shrink-0" />
                    {product.pricingSummary || "Contact Sales"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200 space-y-3">
          <Building2 className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-sm font-medium text-neutral-600">No products found matching filter</p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isEditing && currentProduct && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                {currentProduct.id ? "Edit Product Offering" : "Add New Product Offering"}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Product Name *</label>
                <input
                  type="text"
                  required
                  value={currentProduct.name || ""}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                  placeholder="e.g. OmniRank Growth Cloud"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Category</label>
                <input
                  type="text"
                  value={currentProduct.category || ""}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, category: e.target.value })}
                  placeholder="e.g. Enterprise Software, Infrastructure, SaaS"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Value Proposition</label>
                <textarea
                  rows={3}
                  value={currentProduct.valueProposition || ""}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, valueProposition: e.target.value })}
                  placeholder="What core problem does this solve and what is its unique differentiation?"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Feature Tag Editor */}
              <div className="space-y-2">
                <label className="font-semibold text-neutral-700">Key Features</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                    placeholder="Type feature name & click Add"
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(currentProduct.keyFeatures || []).map((f, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium"
                    >
                      {f}
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="hover:text-rose-600 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Target Audience</label>
                  <input
                    type="text"
                    value={currentProduct.targetAudience || ""}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, targetAudience: e.target.value })}
                    placeholder="e.g. VP Marketing, DevOps Leads"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Pricing Summary</label>
                  <input
                    type="text"
                    value={currentProduct.pricingSummary || ""}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, pricingSummary: e.target.value })}
                    placeholder="e.g. $499/mo or Custom Enterprise"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
