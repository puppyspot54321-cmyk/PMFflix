import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { supabase } from "./supabase";

type AdminStudioProps = {
  onClose: () => void;
};

type Movie = {
  id: number;
  title: string | null;
  year: number | null;
  description: string | null;
  category: string | null;
  type: string | null;
  duration: string | null;
  rating: string | null;
  poster_url: string | null;
  video_url: string | null;
  trailer_url: string | null;
  featured: boolean | null;
  downloadable: boolean | null;
};

type MediaAsset = {
  id: string;
  movie_id: number | null;
  title: string;
  slug: string;
  media_type: string;
  status: string;
  processing_status: string;
  featured: boolean;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
};

type MovieForm = {
  title: string;
  year: string;
  description: string;
  category: string;
  type: string;
  duration: string;
  rating: string;
  poster_url: string;
  video_url: string;
  trailer_url: string;
  featured: boolean;
  downloadable: boolean;
};

const EMPTY_FORM: MovieForm = {
  title: "",
  year: "",
  description: "",
  category: "",
  type: "Movie",
  duration: "",
  rating: "",
  poster_url: "",
  video_url: "",
  trailer_url: "",
  featured: false,
  downloadable: false,
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-amber-400/60 focus:bg-white/[0.07]";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function AdminStudio({ onClose }: AdminStudioProps) {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");

  const [movies, setMovies] = useState<Movie[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MovieForm>(EMPTY_FORM);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadStudio = async () => {
    setLoading(true);
    setError("");

    const [movieResult, assetResult] = await Promise.all([
      supabase
        .from("movies")
        .select(
          "id,title,year,description,category,type,duration,rating,poster_url,video_url,trailer_url,featured,downloadable",
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("media_assets")
        .select(
          "id,movie_id,title,slug,media_type,status,processing_status,featured,poster_url,backdrop_url,trailer_url",
        )
        .order("created_at", { ascending: false }),
    ]);

    if (movieResult.error) {
      setError(movieResult.error.message);
    } else {
      setMovies((movieResult.data ?? []) as Movie[]);
    }

    if (assetResult.error) {
      setError((current) =>
        current
          ? `${current} | ${assetResult.error?.message ?? ""}`
          : assetResult.error?.message ?? "",
      );
    } else {
      setAssets((assetResult.data ?? []) as MediaAsset[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    const verifyAdmin = async () => {
      setCheckingAccess(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setAuthorized(false);
        setCheckingAccess(false);
        return;
      }

      const { data, error: roleError } = await supabase
        .from("media_admins")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (roleError) {
        setError(roleError.message);
        setAuthorized(false);
      } else if (
        data &&
        ["owner", "admin", "editor"].includes(String(data.role))
      ) {
        setRole(String(data.role));
        setAuthorized(true);
        await loadStudio();
      } else {
        setAuthorized(false);
      }

      if (active) {
        setCheckingAccess(false);
      }
    };

    verifyAdmin();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const featured = movies.filter((movie) => movie.featured).length;
    const playable = movies.filter(
      (movie) => Boolean(movie.video_url?.trim()),
    ).length;

    return {
      catalogue: movies.length,
      featured,
      playable,
      pending: movies.length - playable,
      assets: assets.length,
    };
  }, [movies, assets]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setNotice("");
    setError("");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (movie: Movie) => {
    setNotice("");
    setError("");
    setEditingId(movie.id);

    setForm({
      title: movie.title ?? "",
      year: movie.year ? String(movie.year) : "",
      description: movie.description ?? "",
      category: movie.category ?? "",
      type: movie.type ?? "Movie",
      duration: movie.duration ?? "",
      rating: movie.rating ?? "",
      poster_url: movie.poster_url ?? "",
      video_url: movie.video_url ?? "",
      trailer_url: movie.trailer_url ?? "",
      featured: Boolean(movie.featured),
      downloadable: Boolean(movie.downloadable),
    });

    setShowForm(true);
  };

  const updateField = <K extends keyof MovieForm>(
    field: K,
    value: MovieForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveMovie = async () => {
    setNotice("");
    setError("");

    if (!form.title.trim()) {
      setError("A title is required.");
      return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      year: form.year ? Number(form.year) : null,
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      type: form.type.trim() || "Movie",
      duration: form.duration.trim() || null,
      rating: form.rating.trim() || null,
      poster_url: form.poster_url.trim() || null,
      video_url: form.video_url.trim() || null,
      trailer_url: form.trailer_url.trim() || null,
      featured: form.featured,
      downloadable: form.downloadable,
    };

    const result = editingId
      ? await supabase
          .from("movies")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single()
      : await supabase
          .from("movies")
          .insert(payload)
          .select()
          .single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    await loadStudio();

    setSaving(false);
    setNotice(
      editingId
        ? "Title updated successfully."
        : "Title created successfully.",
    );
    resetForm();
  };

  const deleteMovie = async (movie: Movie) => {
    const confirmed = window.confirm(
      `Delete "${movie.title ?? "this title"}" from the PMF catalogue?`,
    );

    if (!confirmed) return;

    setDeleting(movie.id);
    setNotice("");
    setError("");

    const { error: deleteError } = await supabase
      .from("movies")
      .delete()
      .eq("id", movie.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(null);
      return;
    }

    setMovies((current) => current.filter((item) => item.id !== movie.id));
    setAssets((current) =>
      current.filter((asset) => asset.movie_id !== movie.id),
    );

    setDeleting(null);
    setNotice("Title deleted successfully.");
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" />
          Checking PMF Studio access...
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <ShieldCheck className="mx-auto mb-5 h-12 w-12 text-amber-400" />

          <h1 className="text-2xl font-bold">PMF Studio</h1>

          <p className="mt-3 text-sm leading-6 text-white/55">
            This workspace is restricted to authorized PMF Media Core
            administrators and editors.
          </p>

          <button
            onClick={onClose}
            className={`${buttonClass} mt-7 w-full bg-white text-black hover:bg-white/90`}
          >
            <ArrowLeft className="h-4 w-4" />
            Return to PMF-Flix
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Return to PMF-Flix"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight">
                  PMF <span className="text-amber-400">STUDIO</span>
                </span>

                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  {role}
                </span>
              </div>

              <p className="text-xs text-white/40">
                PMF Media Core content workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadStudio}
              disabled={loading}
              className={`${buttonClass} border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/10`}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={openCreate}
              className={`${buttonClass} bg-amber-400 text-black hover:bg-amber-300`}
            >
              <Plus className="h-4 w-4" />
              Add Title
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-7 md:px-8">
        <div className="mb-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
            Command Center
          </p>

          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            Build the PMF entertainment universe.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
            Manage catalogue metadata and connect your titles to the PMF Media
            Core without disturbing the existing viewer experience.
          </p>
        </div>

        {notice && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              label: "Catalogue",
              value: stats.catalogue,
              icon: Film,
            },
            {
              label: "Featured",
              value: stats.featured,
              icon: ImageIcon,
            },
            {
              label: "Playable",
              value: stats.playable,
              icon: Video,
            },
            {
              label: "Media Pending",
              value: stats.pending,
              icon: Upload,
            },
            {
              label: "Media Assets",
              value: stats.assets,
              icon: ShieldCheck,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white/45">
                    {item.label}
                  </span>

                  <Icon className="h-4 w-4 text-amber-400" />
                </div>

                <div className="mt-3 text-3xl font-black">
                  {item.value}
                </div>
              </div>
            );
          })}
        </section>

        {showForm && (
          <section className="mt-7 rounded-3xl border border-amber-400/15 bg-white/[0.035] p-5 shadow-2xl md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                  {editingId ? "Edit title" : "New title"}
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {editingId
                    ? "Update catalogue entry"
                    : "Create catalogue entry"}
                </h2>
              </div>

              <button
                onClick={resetForm}
                className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Close form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Title *
                </span>

                <input
                  value={form.title}
                  onChange={(event) =>
                    updateField("title", event.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. The Journey"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Year
                </span>

                <input
                  type="number"
                  value={form.year}
                  onChange={(event) =>
                    updateField("year", event.target.value)
                  }
                  className={inputClass}
                  placeholder="2026"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Type
                </span>

                <select
                  value={form.type}
                  onChange={(event) =>
                    updateField("type", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="Movie">Movie</option>
                  <option value="Series">Series</option>
                  <option value="Documentary">Documentary</option>
                  <option value="Short">Short</option>
                  <option value="Special">Special</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Category
                </span>

                <input
                  value={form.category}
                  onChange={(event) =>
                    updateField("category", event.target.value)
                  }
                  className={inputClass}
                  placeholder="Action, Adventure, Drama..."
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Duration
                </span>

                <input
                  value={form.duration}
                  onChange={(event) =>
                    updateField("duration", event.target.value)
                  }
                  className={inputClass}
                  placeholder="2h 08m"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Rating
                </span>

                <input
                  value={form.rating}
                  onChange={(event) =>
                    updateField("rating", event.target.value)
                  }
                  className={inputClass}
                  placeholder="PG-13 / 8.5"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Description
                </span>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  className={`${inputClass} min-h-32 resize-y`}
                  placeholder="Write the professional synopsis for the title..."
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Poster URL
                </span>

                <input
                  value={form.poster_url}
                  onChange={(event) =>
                    updateField("poster_url", event.target.value)
                  }
                  className={inputClass}
                  placeholder="https://..."
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Video URL
                </span>

                <input
                  value={form.video_url}
                  onChange={(event) =>
                    updateField("video_url", event.target.value)
                  }
                  className={inputClass}
                  placeholder="https://...mp4 or playable source"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/55">
                  Trailer URL
                </span>

                <input
                  value={form.trailer_url}
                  onChange={(event) =>
                    updateField("trailer_url", event.target.value)
                  }
                  className={inputClass}
                  placeholder="YouTube or video URL"
                />
              </label>

              <div className="md:col-span-2 flex flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) =>
                      updateField("featured", event.target.checked)
                    }
                    className="h-4 w-4 accent-amber-400"
                  />

                  <span className="text-sm text-white/75">
                    Feature this title
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.downloadable}
                    onChange={(event) =>
                      updateField("downloadable", event.target.checked)
                    }
                    className="h-4 w-4 accent-amber-400"
                  />

                  <span className="text-sm text-white/75">
                    Allow downloads
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={resetForm}
                disabled={saving}
                className={`${buttonClass} border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10`}
              >
                Cancel
              </button>

              <button
                onClick={saveMovie}
                disabled={saving}
                className={`${buttonClass} bg-amber-400 text-black hover:bg-amber-300`}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Create Title"}
              </button>
            </div>
          </section>
        )}

        <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                Catalogue
              </p>

              <h2 className="mt-1 text-xl font-black">
                Titles
              </h2>
            </div>

            <span className="text-xs text-white/35">
              {movies.length} catalogue{" "}
              {movies.length === 1 ? "title" : "titles"}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-white/50">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading PMF catalogue...
            </div>
          ) : movies.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Film className="mx-auto h-10 w-10 text-white/20" />

              <p className="mt-4 font-semibold">
                Your catalogue is empty.
              </p>

              <p className="mt-2 text-sm text-white/40">
                Create your first PMF title to begin building the library.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {movies.map((movie) => {
                const assetCount = assets.filter(
                  (asset) => asset.movie_id === movie.id,
                ).length;

                const playable = Boolean(movie.video_url?.trim());

                return (
                  <div
                    key={movie.id}
                    className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:px-7"
                  >
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-white/5">
                      {movie.poster_url ? (
                        <img
                          src={movie.poster_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Film className="h-5 w-5 text-white/20" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold">
                          {movie.title || "Untitled"}
                        </h3>

                        {movie.featured && (
                          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                            Featured
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40">
                        {movie.year && <span>{movie.year}</span>}
                        {movie.type && <span>{movie.type}</span>}
                        {movie.category && (
                          <span>{movie.category}</span>
                        )}
                        {movie.rating && <span>{movie.rating}</span>}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            playable
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-orange-400/10 text-orange-300"
                          }`}
                        >
                          {playable ? "PLAYABLE" : "MEDIA PENDING"}
                        </span>

                        {assetCount > 0 && (
                          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/40">
                            {assetCount} media asset
                            {assetCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => openEdit(movie)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white/60 transition hover:bg-white/10 hover:text-white"
                        aria-label={`Edit ${movie.title ?? "title"}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => deleteMovie(movie)}
                        disabled={deleting === movie.id}
                        className="rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3 text-red-300/70 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
                        aria-label={`Delete ${movie.title ?? "title"}`}
                      >
                        {deleting === movie.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-5 md:px-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
              Media Core
            </p>

            <h2 className="mt-1 text-xl font-black">
              Media Assets
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
              These records are the bridge between catalogue titles and the
              professional media storage and processing pipeline.
            </p>
          </div>

          {assets.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Upload className="mx-auto h-9 w-9 text-white/15" />

              <p className="mt-4 font-semibold text-white/70">
                No media assets have been registered yet.
              </p>

              <p className="mt-2 text-sm text-white/35">
                Your catalogue can exist before its production media is
                connected.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 md:p-7 xl:grid-cols-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">
                        {asset.title || "Untitled asset"}
                      </h3>

                      <p className="mt-1 truncate text-xs text-white/35">
                        {asset.slug}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/45">
                      {asset.media_type}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/[0.035] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/30">
                        Publishing
                      </p>

                      <p className="mt-1 text-xs font-semibold text-white/70">
                        {asset.status}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.035] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/30">
                        Processing
                      </p>

                      <p className="mt-1 text-xs font-semibold text-white/70">
                        {asset.processing_status}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {asset.movie_id && (
                      <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/40">
                        Movie #{asset.movie_id}
                      </span>
                    )}

                    {asset.featured && (
                      <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                        Featured
                      </span>
                    )}

                    {asset.status === "published" && (
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                        Published
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-7 rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/[0.08] via-white/[0.025] to-transparent p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                PMF Media Core
              </div>

              <h2 className="text-2xl font-black">
                Catalogue first. Media infrastructure next.
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/45">
                PMF Studio is intentionally separated from the viewer
                experience. This lets the PMF-Flix catalogue grow while the
                underlying storage, processing, variants, subtitles, and
                delivery pipeline are developed independently.
              </p>
            </div>

            <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-400/10 p-3">
                  <Video className="h-5 w-5 text-amber-400" />
                </div>

                <div>
                  <p className="text-xs text-white/35">
                    Production readiness
                  </p>

                  <p className="mt-1 font-bold">
                    {stats.playable}/{stats.catalogue} playable
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="py-10 text-center text-xs text-white/20">
          PMF-Flix · PMF Studio · PMF Media Core
        </footer>
      </main>
    </div>
  );
}

export default AdminStudio;
