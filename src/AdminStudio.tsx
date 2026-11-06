import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Film,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
  BookOpen,
  Newspaper,
  Smile,
  Trophy,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabase";
import PMFLogo from "./components/PMFLogo";
import ShortContentManager from "./components/studio/ShortContentManager";
import NovelsManager from "./components/studio/NovelsManager";
import SportsManager from "./components/studio/SportsManager";
import Midnight18Manager from "./components/studio/Midnight18Manager";
import {
  notifyMovieUpdates,
  deleteMovieFromCache,
  upsertMovieInCache,
  parseTelegramChannelCaption,
  getExtendedMovieMetaMap,
  saveExtendedMovieMeta,
  isVerifiedOwnerEmail,
  filterOutUnapprovedMovies,
  findDuplicateMovie,
} from "./services/movieService";
import {
  PMF_TELEGRAM_BRIDGE_BASE,
  type MoviePublishStatus,
} from "./movieData/movies";

type StudioTab = "movies" | "skits" | "news" | "novels" | "sports" | "midnight18";

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
  backdrop_url?: string | null;
  video_type?: string | null;
  video_url: string | null;
  trailer_url: string | null;
  featured: boolean | null;
  downloadable: boolean | null;
  series_title?: string | null;
  season_number?: number | null;
  episode_number?: number | null;
  telegram_message_id?: number | string | null;
  is_midnight_18?: boolean | null;
  is_kids?: boolean | null;
  status?: MoviePublishStatus | null;
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
  backdrop_url: string;
  video_type: string;
  video_url: string;
  trailer_url: string;
  featured: boolean;
  downloadable: boolean;
  series_title: string;
  season_number: string;
  episode_number: string;
  telegram_message_id: string;
  is_midnight_18: boolean;
  is_kids: boolean;
  status: MoviePublishStatus;
};

const EMPTY_FORM: MovieForm = {
  title: "",
  year: String(new Date().getFullYear()),
  description: "",
  category: "",
  type: "Movie",
  duration: "",
  rating: "",
  poster_url: "",
  backdrop_url: "",
  video_type: "mp4",
  video_url: "",
  trailer_url: "",
  featured: false,
  downloadable: true,
  series_title: "",
  season_number: "",
  episode_number: "",
  telegram_message_id: "",
  is_midnight_18: false,
  is_kids: false,
  status: "draft",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-amber-400/60 focus:bg-white/[0.07]";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function AdminStudio({ onClose }: AdminStudioProps) {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");
  const [activeTab, setActiveTab] = useState<StudioTab>("movies");

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

  // Enhanced Admin Studio state for search, filtering, and preview
  const [searchFilter, setSearchFilter] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<"all" | "playable" | "pending">("all");
  const [featuredFilter, setFeaturedFilter] = useState<"all" | "featured">("all");
  const [posterLoadError, setPosterLoadError] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [telegramCaptionInput, setTelegramCaptionInput] = useState("");
  const [probingStream, setProbingStream] = useState(false);
  const [streamProbeResult, setStreamProbeResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const loadStudio = async () => {
    setLoading(true);
    setError("");

    const [movieResult, assetResult] = await Promise.all([
      supabase
        .from("movies")
        .select(
          "id,title,year,description,category,type,duration,rating,poster_url,backdrop_url,video_type,video_url,trailer_url,featured,downloadable,series_title,season_number,episode_number,telegram_message_id,is_midnight_18,is_kids,status",
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
    } else if (movieResult.data && movieResult.data.length > 0) {
      setMovies(filterOutUnapprovedMovies(movieResult.data as Movie[]));
    } else {
      // An empty Supabase result is authoritative. Never resurrect bundled or cached titles.
      setMovies([]);
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

      if (!isSupabaseConfigured) {
        setError("Supabase configuration missing. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.");
        setCheckingAccess(false);
        setAuthorized(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setAuthorized(false);
        setCheckingAccess(false);
        return;
      }

      if (isVerifiedOwnerEmail(user.email)) {
        setRole("owner");
        setAuthorized(true);
        await loadStudio();
        if (active) {
          setCheckingAccess(false);
        }
        return;
      }

      // PMF-Flix owner-only policy: database role rows must never grant Studio access
      // to another email. Only the verified owner account above may manage the catalogue.
      setAuthorized(false);
      setError("Owner-only access. Sign in with the verified PMF-Flix owner account to manage titles.");
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

  // Filtered catalogue listing
  const filteredMovies = useMemo(() => {
    return movies.filter((movie) => {
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase().trim();
        const matchTitle = (movie.title || "").toLowerCase().includes(q);
        const matchCategory = (movie.category || "").toLowerCase().includes(q);
        const matchYear = String(movie.year || "").includes(q);
        if (!matchTitle && !matchCategory && !matchYear) return false;
      }
      const isPlayable = Boolean(movie.video_url?.trim());
      if (readinessFilter === "playable" && !isPlayable) return false;
      if (readinessFilter === "pending" && isPlayable) return false;
      if (featuredFilter === "featured" && !movie.featured) return false;
      return true;
    });
  }, [movies, searchFilter, readinessFilter, featuredFilter]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setPosterLoadError(false);
    setTelegramCaptionInput("");
    setStreamProbeResult(null);
  };

  const openCreate = () => {
    setNotice("");
    setError("");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPosterLoadError(false);
    setTelegramCaptionInput("");
    setStreamProbeResult(null);
    setShowForm(true);
  };

  const openEdit = (movie: Movie) => {
    setNotice("");
    setError("");
    setEditingId(movie.id);
    setPosterLoadError(false);
    setStreamProbeResult(null);

    const ext = getExtendedMovieMetaMap()[String(movie.id)] || {};

    setForm({
      title: movie.title ?? "",
      year: movie.year ? String(movie.year) : "",
      description: movie.description ?? "",
      category: movie.category ?? "",
      type: movie.type ?? "Movie",
      duration: movie.duration ?? "",
      rating: movie.rating ?? "",
      poster_url: movie.poster_url ?? "",
      backdrop_url: movie.backdrop_url ?? "",
      video_type: movie.video_type ?? "mp4",
      video_url: movie.video_url ?? "",
      trailer_url: movie.trailer_url ?? "",
      featured: Boolean(movie.featured),
      downloadable: movie.downloadable !== false,
      series_title: movie.series_title ?? ext.seriesTitle ?? "",
      season_number: movie.season_number != null ? String(movie.season_number) : ext.seasonNumber ? String(ext.seasonNumber) : "",
      episode_number: movie.episode_number != null ? String(movie.episode_number) : ext.episodeNumber ? String(ext.episodeNumber) : "",
      telegram_message_id: movie.telegram_message_id != null ? String(movie.telegram_message_id) : ext.telegramMessageId ? String(ext.telegramMessageId) : "",
      is_midnight_18:
        Boolean(movie.is_midnight_18 ?? ext.isMidnight18) ||
        /18\+|midnight|adult/i.test(`${movie.category ?? ""} ${movie.rating ?? ""}`),
      is_kids: Boolean(movie.is_kids ?? ext.isKids),
      status: movie.status || ext.status || "published",
    });

    setShowForm(true);
  };

  const duplicateMovie = (movie: Movie) => {
    setNotice("");
    setError("");
    setEditingId(null);
    setPosterLoadError(false);
    setStreamProbeResult(null);

    const ext = getExtendedMovieMetaMap()[String(movie.id)] || {};

    setForm({
      title: `${movie.title ?? "Untitled"} (Copy)`,
      year: movie.year ? String(movie.year) : "",
      description: movie.description ?? "",
      category: movie.category ?? "",
      type: movie.type ?? "Movie",
      duration: movie.duration ?? "",
      rating: movie.rating ?? "",
      poster_url: movie.poster_url ?? "",
      backdrop_url: movie.backdrop_url ?? "",
      video_type: movie.video_type ?? "mp4",
      video_url: movie.video_url ?? "",
      trailer_url: movie.trailer_url ?? "",
      featured: false,
      downloadable: movie.downloadable !== false,
      series_title: ext.seriesTitle ?? "",
      season_number: ext.seasonNumber ? String(ext.seasonNumber) : "",
      episode_number: ext.episodeNumber ? String(ext.episodeNumber) : "",
      telegram_message_id: ext.telegramMessageId ? String(ext.telegramMessageId) : "",
      is_midnight_18: Boolean(ext.isMidnight18),
      is_kids: Boolean(ext.isKids),
      status: "draft",
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

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePosterUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the poster.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Poster image must be 50 MB or smaller.");
      return;
    }

    setUploadingPoster(true);
    setError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const folder = editingId ? String(editingId) : "new-titles";
    const path = `movies/${folder}/${Date.now()}-${safeName}`;
    const { data, error: uploadError } = await supabase.storage
      .from("movie-posters")
      .upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError || !data) {
      setError(uploadError?.message || "Poster upload failed.");
      setUploadingPoster(false);
      return;
    }

    const { data: publicData } = supabase.storage
      .from("movie-posters")
      .getPublicUrl(data.path);
    updateField("poster_url", publicData.publicUrl);
    setPosterLoadError(false);
    setNotice("Poster uploaded to the existing Supabase movie-posters bucket. Save the title to apply it.");
    setUploadingPoster(false);
  };

  const handleApplyTelegramCaption = () => {
    if (!telegramCaptionInput.trim()) return;
    const parsed = parseTelegramChannelCaption(telegramCaptionInput);

    const mappedType =
      parsed.type === "series"
        ? "Series"
        : parsed.type === "short" || parsed.type === "skit"
          ? "Short"
          : "Movie";

    setForm((current) => ({
      ...current,
      title: parsed.title || current.title,
      year: parsed.year ? String(parsed.year) : current.year,
      category:
        parsed.mature && !parsed.category.toLowerCase().includes("midnight")
          ? `${parsed.category}, Midnight 18+`
          : parsed.category || current.category,
      type: mappedType,
      duration: parsed.duration || current.duration,
      rating: parsed.rating || (parsed.mature ? "18+" : current.rating),
      description: parsed.summary || current.description,
      poster_url: parsed.posterUrl || current.poster_url,
      video_url: parsed.videoUrl || current.video_url,
      downloadable: parsed.downloadable,
      series_title: parsed.seriesTitle || current.series_title,
      season_number:
        parsed.seasonNumber !== undefined
          ? String(parsed.seasonNumber)
          : current.season_number,
      episode_number:
        parsed.episodeNumber !== undefined
          ? String(parsed.episodeNumber)
          : current.episode_number,
      telegram_message_id: parsed.telegramMessageId || current.telegram_message_id,
      is_midnight_18: parsed.mature,
      is_kids: parsed.kidsSafe,
      status: parsed.status || "pending",
    }));

    setNotice(
      "Telegram caption parsed and staged as PENDING APPROVAL. Review fields and click 'Approve & Publish' when ready.",
    );
  };

  const handleVerifyStreamRange = async () => {
    const url = form.video_url.trim();
    if (!url) return;
    setProbingStream(true);
    setStreamProbeResult(null);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-63" },
      });

      if (res.status === 206 || res.status === 200) {
        const ct = res.headers.get("content-type") || "video/mp4";
        const cr = res.headers.get("content-range") || "";
        const totalMatch = cr.match(/\/(\d+)/);
        const sizeMb = totalMatch?.[1]
          ? `${(Number(totalMatch[1]) / (1024 * 1024)).toFixed(1)} MB`
          : "verified stream";
        setStreamProbeResult({
          ok: true,
          message: `HTTP ${res.status} (${ct}) • Byte-Range Ready • Total Size: ${sizeMb}`,
        });
      } else {
        let errDetail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) errDetail = `${errDetail} — ${j.error}`;
        } catch {}
        setStreamProbeResult({
          ok: false,
          message: `Stream returned ${errDetail}`,
        });
      }
    } catch (err: unknown) {
      setStreamProbeResult({
        ok: false,
        message:
          (err as { message?: string })?.message ||
          "Could not reach stream endpoint.",
      });
    } finally {
      setProbingStream(false);
    }
  };

  const saveMovie = async (explicitStatus?: MoviePublishStatus) => {
    setNotice("");
    setError("");

    if (!form.title.trim()) {
      setError("A title is required.");
      return;
    }

    // Duplicate prevention check (by Telegram Message ID or Title + Season + Episode)
    const duplicate = findDuplicateMovie(
      {
        id: editingId,
        title: form.title,
        seriesTitle: form.series_title,
        seasonNumber: form.season_number,
        episodeNumber: form.episode_number,
        telegramMessageId: form.telegram_message_id,
      },
      movies,
    );

    if (duplicate) {
      setError(
        `Duplicate detected: "${duplicate.title || "Existing title"}" (ID #${duplicate.id}) already uses this Telegram Message ID or Title/Season/Episode combination. Edit the existing entry instead of creating a duplicate.`,
      );
      return;
    }

    const targetStatus: MoviePublishStatus = explicitStatus || form.status || "published";

    setSaving(true);

    const resolvedCategory = form.is_midnight_18
      ? form.category.toLowerCase().includes("midnight") ||
        form.category.toLowerCase().includes("18+")
        ? form.category.trim()
        : `${form.category.trim() ? `${form.category.trim()} · ` : ""}Midnight 18+`
      : form.category.trim() || null;

    // A Telegram message ID is not a movie ID. The bridge route must use
    // the saved PMF-Flix movie ID and resolve the mapped Telegram post server-side.
    const resolvedVideoUrl = form.video_url.trim() || null;

    const payload = {
      title: form.title.trim(),
      year: form.year ? Number(form.year) : null,
      description: form.description.trim() || null,
      category: resolvedCategory,
      type: form.type.trim() || "Movie",
      duration: form.duration.trim() || null,
      rating:
        form.rating.trim() ||
        (form.is_midnight_18 ? "18+" : form.is_kids ? "PG" : null),
      poster_url: form.poster_url.trim() || null,
      backdrop_url: form.backdrop_url.trim() || null,
      video_type: form.video_type.trim() || "mp4",
      video_url: resolvedVideoUrl,
      trailer_url: form.trailer_url.trim() || null,
      featured:
        form.is_midnight_18 || targetStatus !== "published" ? false : form.featured,
      downloadable: form.downloadable,
      series_title: form.series_title.trim() || null,
      season_number: form.season_number ? Number(form.season_number) : null,
      episode_number: form.episode_number ? Number(form.episode_number) : null,
      telegram_message_id: form.telegram_message_id.trim() && /^\d+$/.test(form.telegram_message_id.trim())
        ? Number(form.telegram_message_id.trim())
        : null,
      is_midnight_18: form.is_midnight_18,
      is_kids: !form.is_midnight_18 && form.is_kids,
      status: targetStatus,
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

    const savedId = result.data?.id ?? editingId;
    let telegramIntentReady = false;
    if (savedId !== undefined && savedId !== null) {
      const { data: existingMapping, error: mappingError } = await supabase
        .from("telegram_media_refs")
        .select("id")
        .eq("movie_id", Number(savedId))
        .maybeSingle();

      if (mappingError) {
        console.error("Could not check the existing Telegram mapping:", mappingError);
      } else if (!existingMapping) {
        const { error: intentError } = await supabase
          .from("telegram_upload_intents")
          .upsert(
            { movie_id: Number(savedId), status: "pending" },
            { onConflict: "movie_id", ignoreDuplicates: true },
          );
        telegramIntentReady = !intentError;
        if (intentError) {
          console.error("Could not create Telegram upload intent:", intentError);
        }
      }
    }
    if (savedId !== undefined && savedId !== null) {
      saveExtendedMovieMeta(savedId, {
        seriesTitle: form.series_title.trim() || undefined,
        seasonNumber: form.season_number ? Number(form.season_number) : undefined,
        episodeNumber: form.episode_number ? Number(form.episode_number) : undefined,
        telegramMessageId: form.telegram_message_id.trim() || undefined,
        isMidnight18: form.is_midnight_18,
        isKids: !form.is_midnight_18 && form.is_kids,
        status: targetStatus,
      });
      upsertMovieInCache({
        ...result.data,
        series_title: form.series_title.trim() || null,
        season_number: form.season_number ? Number(form.season_number) : null,
        episode_number: form.episode_number ? Number(form.episode_number) : null,
        telegram_message_id: form.telegram_message_id.trim() || null,
        is_midnight_18: form.is_midnight_18,
        is_kids: !form.is_midnight_18 && form.is_kids,
        status: targetStatus,
      });
    }

    await loadStudio();
    notifyMovieUpdates();

    setSaving(false);
    const baseNotice = editingId
      ? `Title updated (${targetStatus.toUpperCase()}).`
      : targetStatus === "published"
        ? "Title approved and published to public catalogue."
        : `Title saved as ${targetStatus.toUpperCase()} (hidden from public until approved).`;
    const uploadInstruction =
      savedId !== undefined &&
      savedId !== null &&
      telegramIntentReady
        ? ` To attach its video, post the file to your existing PMF Media Vault with this exact caption line: PMF_MOVIE_ID: ${savedId}. The bridge will match that upload to this title.`
        : "";
    setNotice(baseNotice + uploadInstruction);
    resetForm();
  };

  const prepareTelegramUpload = async (movie: Movie) => {
    const { error: intentError } = await supabase
      .from("telegram_upload_intents")
      .upsert(
        { movie_id: movie.id, status: "pending", fulfilled_at: null },
        { onConflict: "movie_id" },
      );
    if (intentError) {
      setError(intentError.message);
      return;
    }

    const marker = `PMF_MOVIE_ID: ${movie.id}`;
    try {
      await navigator.clipboard?.writeText(marker);
    } catch {
      // The marker remains visible in the Studio notice if clipboard access is unavailable.
    }
    setNotice(`Upload or replace the video for "${movie.title}" in your existing PMF Media Vault. The caption marker has been copied: ${marker}`);
  };

  const deleteMovie = async (movie: Movie) => {
    setDeleting(movie.id);
    setConfirmDeleteId(null);
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

    deleteMovieFromCache(movie.id);
    notifyMovieUpdates();

    setMovies((current) => current.filter((item) => item.id !== movie.id));
    setAssets((current) =>
      current.filter((asset) => asset.movie_id !== movie.id),
    );

    setDeleting(null);
    setNotice("Title deleted successfully.");
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#030208] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          Checking PMF Studio access credentials...
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#030208] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
            <ShieldCheck className="h-7 w-7 text-amber-400" />
          </div>

          <h1 className="text-2xl font-black tracking-tight">PMF Studio</h1>

          <p className="mt-3 text-sm leading-6 text-white/55">
            This administrative command centre is reserved for authorized PMF Media Core
            administrators (<code className="rounded bg-white/10 px-1 py-0.5 text-xs text-amber-300">media_admins</code>).
          </p>

          <button
            onClick={onClose}
            className={`${buttonClass} mt-7 w-full bg-white text-black hover:bg-white/90 shadow-lg`}
          >
            <ArrowLeft className="h-4 w-4" />
            Return to PMF-Flix
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pmf-admin-studio min-h-screen bg-[#030208] text-white antialiased">
      {/* Studio Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#030208]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Return to PMF-Flix"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <PMFLogo size={32} />
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="pmf-studio-wordmark inline-flex items-center gap-2 text-base font-black tracking-[0.08em] sm:text-lg">
                    <span className="text-white">PMF</span>
                    <span className="pmf-studio-as" aria-label="Admin Studio">
                      <span className="pmf-studio-as-glow" aria-hidden="true" />
                      <span className="relative z-10">AS</span>
                    </span>
                  </span>

                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    {role}
                  </span>
                </div>

                <p className="text-xs text-white/40">
                  Administrative content management & media verification
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="/pmf-flix-release-rc.zip"
              download="PMF-Flix-Verified-Release-Candidate.zip"
              className={`${buttonClass} border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20`}
              title="Download Complete Verified Release Candidate Source ZIP"
            >
              <Upload className="h-4 w-4 rotate-180" />
              <span className="hidden sm:inline">Export Source ZIP</span>
            </a>

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

            {activeTab === "movies" && (
              <button
                onClick={openCreate}
                className={`${buttonClass} bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20`}
              >
                <Plus className="h-4 w-4" />
                Add Title
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-7 md:px-8">
        {/* Banner Section */}
        <div className="mb-7">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
            Command Center
          </div>

          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
            PMF Entertainment Universe
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Manage titles, paste Supabase Storage poster URLs, configure Telegram Range streams, and verify playback readiness with zero impact on viewers.
          </p>
        </div>

        {notice && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            {error}
          </div>
        )}

        {/* Unified PMF Studio Channel Switcher */}
        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
          {[
            { id: "movies", label: "Movies & Media", icon: Film },
            { id: "skits", label: "Comedy & Short Skits", icon: Smile },
            { id: "news", label: "News Clips", icon: Newspaper },
            { id: "novels", label: "Novels & Stories", icon: BookOpen },
            { id: "sports", label: "Live Sports & Broadcasts", icon: Trophy },
            { id: "midnight18", label: "Midnight 18+ Vault", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as StudioTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20 font-black"
                    : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white border border-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "skits" && (
          <ShortContentManager filterCategory="comedy" titleLabel="Comedy & Short Skits" />
        )}

        {activeTab === "news" && (
          <ShortContentManager filterCategory="news" titleLabel="News Clips & Reports" />
        )}

        {activeTab === "novels" && <NovelsManager />}

        {activeTab === "sports" && <SportsManager />}

        {activeTab === "midnight18" && (
          <Midnight18Manager
            movies={movies}
            onNotice={setNotice}
            onError={setError}
          />
        )}

        {activeTab === "movies" && (
          <>
            {/* Stats Grid */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              label: "Catalogue",
              value: stats.catalogue,
              sub: "Total titles",
              icon: Film,
            },
            {
              label: "Featured",
              value: stats.featured,
              sub: "Hero candidates",
              icon: ImageIcon,
            },
            {
              label: "Playable Streams",
              value: stats.playable,
              sub: "Ready to watch",
              icon: Video,
            },
            {
              label: "Media Pending",
              value: stats.pending,
              sub: "Awaiting stream URL",
              icon: Upload,
            },
            {
              label: "Media Assets",
              value: stats.assets,
              sub: "Storage pipeline",
              icon: ShieldCheck,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white/45">
                    {item.label}
                  </span>

                  <Icon className="h-4 w-4 text-amber-400" />
                </div>

                <div className="mt-3 text-3xl font-black tracking-tight tabular-nums">
                  {item.value}
                </div>

                <p className="mt-1 text-[11px] text-white/35">
                  {item.sub}
                </p>
              </div>
            );
          })}
        </section>

        {/* Add/Edit Form */}
        {showForm && (
          <section className="mt-7 rounded-3xl border border-amber-400/20 bg-white/[0.035] p-5 shadow-2xl backdrop-blur-xl md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                  {editingId ? "Edit title" : "New title"}
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {editingId ? "Update catalogue entry" : "Create catalogue entry"}
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Changes save directly to Supabase <code className="text-amber-300">movies</code> table.
                </p>
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
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Title *
                </span>

                <input
                  value={form.title}
                  onChange={(event) =>
                    updateField("title", event.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. The Journey, Oloibiri, Night City..."
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/60">
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
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Type
                </span>

                <select
                  value={form.type}
                  onChange={(event) =>
                    updateField("type", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="Movie" className="bg-[#0b0a12]">Movie</option>
                  <option value="Series" className="bg-[#0b0a12]">Series</option>
                  <option value="Documentary" className="bg-[#0b0a12]">Documentary</option>
                  <option value="Short" className="bg-[#0b0a12]">Short Film</option>
                  <option value="Special" className="bg-[#0b0a12]">Special Event</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Catalogue tags / Region + Genres
                </span>

                <input
                  value={form.category}
                  onChange={(event) =>
                    updateField("category", event.target.value)
                  }
                  className={inputClass}
                  placeholder="Nollywood, Nigerian cinema, Drama, Romance..."
                />
                <p className="mt-2 text-[11px] leading-5 text-white/45">
                  Add precise region/country or collection tags plus genres, separated by commas. Examples: “Nollywood, Nigerian cinema, Drama” · “Ghanaian cinema, Romance” · “Swedish cinema, Crime” · “Chinese cinema, Historical Drama” · “Korean cinema, K-Drama” · “Bollywood, Hindi cinema” · “Brazilian cinema, Thriller” · “Australian cinema, Adventure” · “French-language film, Comedy” · “Independent film, Arthouse”. World Cinema matches explicit tags; genre alone does not determine a film’s origin.
                </p>
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Duration
                </span>

                <input
                  value={form.duration}
                  onChange={(event) =>
                    updateField("duration", event.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. 2h 08m or 1h 45m"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Rating / Certificate
                </span>

                <input
                  value={form.rating}
                  onChange={(event) =>
                    updateField("rating", event.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. 16+, 18+, PG-13"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Description / Synopsis
                </span>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  className={`${inputClass} min-h-28 resize-y`}
                  placeholder="Write the cinematic synopsis for this title..."
                />
              </label>

              {/* Poster URL with Supabase Storage Support & Live Preview */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-xs font-semibold text-white/60">
                    Poster URL (Supabase Storage)
                  </span>
                  <span className="text-[11px] text-amber-300/80 font-medium">
                    Paste public storage URL directly
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    value={form.poster_url}
                    onChange={(event) => {
                      setPosterLoadError(false);
                      updateField("poster_url", event.target.value);
                    }}
                    className={`${inputClass} min-w-0 flex-1`}
                    placeholder="Paste a public Supabase Storage poster URL"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-400/20">
                    <Upload className="h-4 w-4" />
                    <span>{uploadingPoster ? "Uploading…" : "Upload poster"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPoster}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        void handlePosterUpload(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {form.poster_url.trim() && (
                  <div className="mt-3 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      <img
                        src={form.poster_url.trim()}
                        alt="Poster Preview"
                        className="h-full w-full object-cover"
                        onError={() => setPosterLoadError(true)}
                        onLoad={() => setPosterLoadError(false)}
                      />
                    </div>
                    <div className="text-xs">
                      {posterLoadError ? (
                        <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                          <AlertCircle className="h-4 w-4" />
                          Image failed to load — check storage bucket permissions or URL
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Supabase Storage Poster Connected & Live
                        </div>
                      )}
                      <p className="mt-1 text-white/40">
                        This URL will be rendered on the homepage, movie rails, and title modal.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-xs font-semibold text-white/60">Backdrop / Featured Artwork URL</span>
                  <input
                    value={form.backdrop_url}
                    onChange={(event) => updateField("backdrop_url", event.target.value)}
                    className={inputClass}
                    placeholder="Supabase Storage backdrop image URL"
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-xs font-semibold text-white/60">Video Format</span>
                  <select
                    value={form.video_type}
                    onChange={(event) => updateField("video_type", event.target.value)}
                    className={inputClass}
                  >
                    <option value="mp4" className="bg-[#0b0a12]">MP4 / Telegram video</option>
                    <option value="hls" className="bg-[#0b0a12]">HLS stream (.m3u8)</option>
                    <option value="youtube" className="bg-[#0b0a12]">YouTube</option>
                  </select>
                </label>
              </div>

              {/* Unified Telegram Channel Caption Quick-Parser */}
              <div className="md:col-span-2 rounded-2xl border border-purple-400/25 bg-purple-950/15 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Unified Telegram Channel Caption Parser
                    </span>
                    <p className="text-[11px] text-white/45">
                      Paste a structured caption from your private PMF Telegram channel (TYPE, TITLE, CATEGORY, SERIES, SEASON, EPISODE, MATURE, KIDS_SAFE, DOWNLOADABLE, SUMMARY) to auto-fill all fields.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyTelegramCaption}
                    disabled={!telegramCaptionInput.trim()}
                    className="rounded-xl bg-purple-500 px-3.5 py-2 text-xs font-black text-white hover:bg-purple-400 disabled:opacity-40 transition"
                  >
                    Parse Telegram Caption
                  </button>
                </div>
                <textarea
                  value={telegramCaptionInput}
                  onChange={(e) => setTelegramCaptionInput(e.target.value)}
                  className={`${inputClass} min-h-20 font-mono text-xs`}
                  placeholder={`TYPE: movie\nTITLE: The Protector\nCATEGORY: Action, Thriller\nMESSAGE_ID: 4\nMATURE: false\nKIDS_SAFE: false\nDOWNLOADABLE: true\nSUMMARY: An elite operative defends the city against overwhelming odds.`}
                />
              </div>

              {/* Series / Season / Episode & Telegram Bridge Mapping */}
              <label>
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Telegram Bridge ID / Message Route (Optional)
                </span>
                <input
                  value={form.telegram_message_id}
                  onChange={(event) => {
                    const idVal = event.target.value.trim();
                    updateField("telegram_message_id", event.target.value);
                    if (
                      idVal &&
                      (!form.video_url.trim() ||
                        form.video_url.includes("pmf-telegram-bridge.onrender.com"))
                    ) {
                      updateField(
                        "video_url",
                        `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/${idVal}`,
                      );
                    }
                  }}
                  className={inputClass}
                  placeholder="e.g. 1, 3, 4, 5..."
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Series Name (For Multi-Episode Series)
                </span>
                <input
                  value={form.series_title}
                  onChange={(event) =>
                    updateField("series_title", event.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. Series Title"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Publishing Approval Status
                </span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as MoviePublishStatus)
                  }
                  className={inputClass}
                >
                  <option value="draft" className="bg-[#0b0a12]">Draft (Private)</option>
                  <option value="pending" className="bg-[#0b0a12]">Pending Owner Approval</option>
                  <option value="published" className="bg-[#0b0a12]">Published (Live on PMF-Flix)</option>
                  <option value="unpublished" className="bg-[#0b0a12]">Unpublished (Hidden)</option>
                  <option value="rejected" className="bg-[#0b0a12]">Rejected</option>
                  <option value="archived" className="bg-[#0b0a12]">Archived (Hidden)</option>
                </select>
              </label>

              {form.type === "Series" || form.series_title.trim() ? (
                <>
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-white/60">
                      Season Number
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.season_number}
                      onChange={(event) =>
                        updateField("season_number", event.target.value)
                      }
                      className={inputClass}
                      placeholder="1"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-xs font-semibold text-white/60">
                      Episode Number
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.episode_number}
                      onChange={(event) =>
                        updateField("episode_number", event.target.value)
                      }
                      className={inputClass}
                      placeholder="1"
                    />
                  </label>
                </>
              ) : null}

              {/* Video URL with Live Playback Testing & HTTP 206 Range Verification */}
              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="block text-xs font-semibold text-white/60">
                    Video Stream URL (Telegram Bridge / MP4 / HLS)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.video_url.trim() && (
                      <>
                        <button
                          type="button"
                          onClick={handleVerifyStreamRange}
                          disabled={probingStream}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20 transition"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          <span>
                            {probingStream ? "Probing Range..." : "Verify HTTP 206 Range"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewVideo({
                              url: form.video_url.trim(),
                              title: form.title || "Stream Test",
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 transition"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          Test Stream Playback
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <input
                  value={form.video_url}
                  onChange={(event) => {
                    setStreamProbeResult(null);
                    updateField("video_url", event.target.value);
                  }}
                  className={inputClass}
                  placeholder="https://pmf-telegram-bridge.onrender.com/telegram-media/1 or direct MP4"
                />

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/35 mr-1">
                    Verified Bridge Routes:
                  </span>
                  {[
                    { label: "Bridge Default (21 MB)", url: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media` },
                    { label: "Movie #1 (886 MB)", url: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/1` },
                    { label: "Movie #3 (836 MB)", url: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/3` },
                    { label: "Movie #4 (413 MB)", url: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/4` },
                    { label: "Movie #5 (1.0 GB)", url: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/5` },
                  ].map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => {
                        setStreamProbeResult(null);
                        updateField("video_url", preset.url);
                      }}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/65 hover:border-amber-400/40 hover:text-amber-300 transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {streamProbeResult && (
                  <div
                    className={`mt-2.5 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                      streamProbeResult.ok
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : "border-rose-400/30 bg-rose-400/10 text-rose-200"
                    }`}
                  >
                    {streamProbeResult.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    )}
                    <span>{streamProbeResult.message}</span>
                  </div>
                )}
              </div>

              {/* Trailer URL */}
              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-white/60">
                  Trailer URL (Optional)
                </span>

                <input
                  value={form.trailer_url}
                  onChange={(event) =>
                    updateField("trailer_url", event.target.value)
                  }
                  className={inputClass}
                  placeholder="https://www.youtube.com/watch?v=... or direct MP4 trailer"
                />
              </label>

              {/* Toggles */}
              <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition">
                  <input
                    type="checkbox"
                    checked={form.featured && !form.is_midnight_18}
                    disabled={form.is_midnight_18}
                    onChange={(event) =>
                      updateField("featured", event.target.checked)
                    }
                    className="h-4 w-4 accent-amber-400"
                  />

                  <div>
                    <span className="text-sm font-semibold text-white/90">
                      Feature on Hero
                    </span>
                    <p className="text-[11px] text-white/40">
                      Homepage spotlight
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition">
                  <input
                    type="checkbox"
                    checked={form.downloadable}
                    onChange={(event) =>
                      updateField("downloadable", event.target.checked)
                    }
                    className="h-4 w-4 accent-amber-400"
                  />

                  <div>
                    <span className="text-sm font-semibold text-white/90">
                      Offline Download
                    </span>
                    <p className="text-[11px] text-white/40">
                      Allow Offline Vault save
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-950/15 px-4 py-3 hover:bg-rose-950/25 transition">
                  <input
                    type="checkbox"
                    checked={form.is_midnight_18}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      updateField("is_midnight_18", checked);
                      if (checked) {
                        updateField("is_kids", false);
                        updateField("featured", false);
                      }
                    }}
                    className="h-4 w-4 accent-rose-500"
                  />

                  <div>
                    <span className="text-sm font-semibold text-rose-200">
                      Midnight 18+ Vault
                    </span>
                    <p className="text-[11px] text-rose-200/50">
                      Strict 18+ DOB/PIN gate
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-3 hover:bg-emerald-950/25 transition">
                  <input
                    type="checkbox"
                    checked={form.is_kids && !form.is_midnight_18}
                    disabled={form.is_midnight_18}
                    onChange={(event) =>
                      updateField("is_kids", event.target.checked)
                    }
                    className="h-4 w-4 accent-emerald-400"
                  />

                  <div>
                    <span className="text-sm font-semibold text-emerald-200">
                      Kids & Family Safe
                    </span>
                    <p className="text-[11px] text-emerald-200/50">
                      Visible on Kids profiles
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end border-t border-white/[0.08] pt-5">
              <button
                onClick={resetForm}
                disabled={saving}
                className={`${buttonClass} border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => saveMovie("pending")}
                disabled={saving}
                className={`${buttonClass} border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20`}
              >
                <Save className="h-4 w-4" />
                Save as Pending Review
              </button>

              <button
                type="button"
                onClick={() => saveMovie("published")}
                disabled={saving}
                className={`${buttonClass} bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20`}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}

                {saving
                  ? "Saving..."
                  : editingId
                    ? "Approve & Save Published"
                    : "Approve & Publish Title"}
              </button>
            </div>
          </section>
        )}

        {/* Catalogue Management Section */}
        <section className="mt-7 rounded-3xl border border-white/[0.08] bg-white/[0.025] overflow-hidden backdrop-blur-sm">
          {/* Section Toolbar */}
          <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                Catalogue Inventory
              </p>

              <h2 className="mt-1 text-xl font-black">
                Titles ({filteredMovies.length} of {movies.length})
              </h2>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter titles..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-white/30 focus:border-amber-400/50 outline-none"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Readiness Filter */}
              <select
                value={readinessFilter}
                onChange={(e) => setReadinessFilter(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 focus:border-amber-400/50 outline-none"
              >
                <option value="all" className="bg-[#0b0a12]">All Status</option>
                <option value="playable" className="bg-[#0b0a12]">Playable Only</option>
                <option value="pending" className="bg-[#0b0a12]">Media Pending</option>
              </select>

              {/* Featured Filter */}
              <select
                value={featuredFilter}
                onChange={(e) => setFeaturedFilter(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 focus:border-amber-400/50 outline-none"
              >
                <option value="all" className="bg-[#0b0a12]">All Categories</option>
                <option value="featured" className="bg-[#0b0a12]">Featured Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-white/50">
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
              Loading PMF catalogue from Supabase...
            </div>
          ) : filteredMovies.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Film className="mx-auto h-10 w-10 text-white/20" />

              <p className="mt-4 font-semibold text-white/80">
                {movies.length === 0 ? "Your catalogue is empty." : "No titles match the filter criteria."}
              </p>

              <p className="mt-1 text-sm text-white/40">
                {movies.length === 0
                  ? "Create your first PMF title above to begin building the library."
                  : "Try clearing the search query or reset filter dropdowns."}
              </p>

              {movies.length === 0 && (
                <button
                  onClick={openCreate}
                  className={`${buttonClass} mt-5 bg-amber-400 text-black hover:bg-amber-300`}
                >
                  <Plus className="h-4 w-4" />
                  Add First Title
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filteredMovies.map((movie) => {
                const assetCount = assets.filter(
                  (asset) => asset.movie_id === movie.id,
                ).length;

                const playable = Boolean(movie.video_url?.trim());

                return (
                  <div
                    key={movie.id}
                    className="flex flex-col gap-4 px-5 py-4 transition hover:bg-white/[0.02] md:flex-row md:items-center md:px-7"
                  >
                    {/* Poster Thumbnail */}
                    <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
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

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold text-base text-white">
                          {movie.title || "Untitled"}
                        </h3>

                        {movie.featured && (
                          <span className="rounded-full bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                            Featured
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/45">
                        {movie.year && <span>{movie.year}</span>}
                        {movie.year && movie.type && <span aria-hidden="true">·</span>}
                        {movie.type && <span>{movie.type}</span>}
                        {movie.type && movie.category && <span aria-hidden="true">·</span>}
                        {movie.category && <span>{movie.category}</span>}
                        {movie.category && movie.duration && <span aria-hidden="true">·</span>}
                        {movie.duration && <span>{movie.duration}</span>}
                        {movie.rating && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-white/60">{movie.rating}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {(() => {
                          const itemStatus = movie.status || "published";
                          return (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                itemStatus === "published"
                                  ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30"
                                  : itemStatus === "pending"
                                    ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                                    : itemStatus === "rejected"
                                      ? "bg-rose-400/15 text-rose-300 border border-rose-400/30"
                                      : "bg-white/10 text-white/60 border border-white/20"
                              }`}
                            >
                              {itemStatus === "published"
                                ? "APPROVED • PUBLISHED"
                                : itemStatus === "pending"
                                  ? "PENDING APPROVAL"
                                  : itemStatus.toUpperCase()}
                            </span>
                          );
                        })()}

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            playable
                              ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20"
                              : "bg-orange-400/10 text-orange-300 border border-orange-400/20"
                          }`}
                        >
                          {playable ? "STREAM READY" : "MEDIA PENDING"}
                        </span>

                        {assetCount > 0 && (
                          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] text-white/40">
                            {assetCount} asset{assetCount === 1 ? "" : "s"}
                          </span>
                        )}

                        {movie.poster_url && (
                          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] text-white/40">
                            Poster active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {(() => {
                        const itemStatus = movie.status || "published";
                        const updatePublicationStatus = async (nextStatus: "published" | "unpublished") => {
                          const { error: statusError } = await supabase
                            .from("movies")
                            .update({
                              status: nextStatus,
                              ...(nextStatus === "unpublished" ? { featured: false } : {}),
                            })
                            .eq("id", movie.id);
                          if (statusError) {
                            setError(statusError.message);
                            return;
                          }
                          saveExtendedMovieMeta(movie.id, { status: nextStatus });
                          setNotice(
                            nextStatus === "published"
                              ? `Approved and published "${movie.title}".`
                              : `Unpublished "${movie.title}" (hidden from public view).`,
                          );
                          notifyMovieUpdates();
                          await loadStudio();
                        };
                        return itemStatus !== "published" ? (
                          <button
                            type="button"
                            onClick={() => void updatePublicationStatus("published")}
                            className="flex items-center gap-1 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-black hover:bg-emerald-300 transition"
                            title="Approve and make publicly visible"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void updatePublicationStatus("unpublished")}
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[11px] font-semibold text-white/65 hover:bg-white/10 hover:text-white transition"
                            title="Unpublish and hide from public view"
                          >
                            Unpublish
                          </button>
                        );
                      })()}

                      <button
                        type="button"
                        onClick={() => void prepareTelegramUpload(movie)}
                        className="flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-400/20"
                        title="Generate or refresh this movie's Telegram upload marker"
                      >
                        <Video className="h-3.5 w-3.5" />
                        <span>Prepare Upload</span>
                      </button>

                      {playable && (
                        <button
                          onClick={() =>
                            setPreviewVideo({
                              url: movie.video_url!.trim(),
                              title: movie.title || "Playback Test",
                            })
                          }
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
                          title="Test Stream Playback"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Test</span>
                        </button>
                      )}

                      {playable && movie.video_url && (
                        <button
                          onClick={() => copyToClipboard(movie.video_url!, movie.id)}
                          className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                          title="Copy Stream URL"
                        >
                          {copiedId === movie.id ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => duplicateMovie(movie)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                        title="Duplicate as new entry"
                      >
                        <Plus className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => openEdit(movie)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                        title="Edit title"
                        aria-label={`Edit ${movie.title ?? "title"}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {confirmDeleteId === movie.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => deleteMovie(movie)}
                            disabled={deleting === movie.id}
                            className="rounded-xl bg-rose-500 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-rose-400 disabled:opacity-50"
                          >
                            {deleting === movie.id ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-xl border border-white/15 px-2 py-1.5 text-[11px] font-semibold text-white/60 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(movie.id)}
                          disabled={deleting === movie.id}
                          className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-2 text-red-300/70 transition hover:bg-red-400/15 hover:text-red-300 disabled:opacity-50"
                          title="Delete title"
                          aria-label={`Delete ${movie.title ?? "title"}`}
                        >
                          {deleting === movie.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Media Core Overview Section */}
        <section className="mt-7 rounded-3xl border border-white/[0.08] bg-white/[0.025] overflow-hidden backdrop-blur-sm">
          <div className="border-b border-white/[0.08] px-5 py-5 md:px-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
              Media Core Pipeline
            </p>

            <h2 className="mt-1 text-xl font-black">
              Media Asset Registry ({assets.length})
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
              Direct connection records between catalogue titles and the professional media storage and streaming pipeline.
            </p>
          </div>

          {assets.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Upload className="mx-auto h-9 w-9 text-white/15" />

              <p className="mt-4 font-semibold text-white/70">
                No pipeline media assets registered yet.
              </p>

              <p className="mt-1 text-sm text-white/35">
                Titles can stream directly via their <code className="text-amber-300">video_url</code> or connect through the Media Core pipeline.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 md:p-7 xl:grid-cols-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-white">
                        {asset.title || "Untitled asset"}
                      </h3>

                      <p className="mt-0.5 truncate text-xs text-white/35">
                        {asset.slug}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/45">
                      {asset.media_type}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
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
                      <span className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/40">
                        Movie #{asset.movie_id}
                      </span>
                    )}

                    {asset.featured && (
                      <span className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                        Featured
                      </span>
                    )}

                    {asset.status === "published" && (
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        Published
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
      )}

        {/* Live Stream Playback Test Modal */}
        {previewVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="relative w-full max-w-3xl rounded-3xl border border-white/15 bg-[#090714] p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-400/10 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Live Stream Test
                    </span>
                    <span className="text-xs text-white/40">HTTP 206 Range Validator</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-white">
                    {previewVideo.title}
                  </h3>
                </div>

                <button
                  onClick={() => setPreviewVideo(null)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Video Player Container */}
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
                {/youtube\.com|youtu\.be/i.test(previewVideo.url) ? (
                  <iframe
                    src={previewVideo.url.replace("watch?v=", "embed/")}
                    title="Trailer Preview"
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={previewVideo.url}
                    controls
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-white/40">
                <p className="truncate max-w-md font-mono text-[11px]">
                  {previewVideo.url}
                </p>
                <button
                  onClick={() => copyToClipboard(previewVideo.url, 99999)}
                  className="inline-flex items-center gap-1.5 text-white/60 hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                  Copy URL
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="py-10 text-center text-xs text-white/20">
          PMF-Flix · PMF Studio Command Centre · Media Core Verified
        </footer>
      </main>
    </div>
  );
}

export default AdminStudio;
