import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

type MovieOption = {
  id: number;
  title: string | null;
  is_midnight_18?: boolean | null;
};

type Option = { id: string; name: string; slug?: string; partner_type?: string };
type Credit = { person_id: string; role: string; character_name?: string; billing_order?: number };
type PartnerCredit = { partner_id: string; role: string };

type SectionConfig = {
  id: string;
  title: string;
  description: string;
  is_enabled: boolean;
  sort_order: number;
  collection_id: string;
  featured_movie_id: string;
  artwork_url: string;
};

type Props = {
  movies: MovieOption[];
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60";
const buttonClass = "rounded-xl bg-violet-500/20 border border-violet-400/30 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-500/30 disabled:opacity-50";
const emptySection: SectionConfig = {
  id: "midnight-18",
  title: "Midnight 18+",
  description: "",
  is_enabled: true,
  sort_order: 90,
  collection_id: "",
  featured_movie_id: "",
  artwork_url: "",
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function Midnight18Manager({ movies, onNotice, onError }: Props) {
  const midnightMovies = useMemo(
    () => movies.filter((movie) => movie.is_midnight_18),
    [movies],
  );
  const [selectedMovieId, setSelectedMovieId] = useState("");
  const [genres, setGenres] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [industries, setIndustries] = useState<Option[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  const [partners, setPartners] = useState<Option[]>([]);
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [industryIds, setIndustryIds] = useState<string[]>([]);
  const [peopleCredits, setPeopleCredits] = useState<Credit[]>([]);
  const [partnerCredits, setPartnerCredits] = useState<PartnerCredit[]>([]);
  const [section, setSection] = useState<SectionConfig>(emptySection);
  const [newKind, setNewKind] = useState("genre");
  const [newName, setNewName] = useState("");
  const [newPartnerType, setNewPartnerType] = useState("studio");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadOptions = async () => {
    setLoading(true);
    const [g, c, i, p, cp, sectionResult] = await Promise.all([
      supabase.from("genres").select("id,name,slug").order("name"),
      supabase.from("collections").select("id,name,slug").order("name"),
      supabase.from("film_industries").select("id,name,slug").order("name"),
      supabase.from("people").select("id,name,slug").order("name"),
      supabase.from("content_partners").select("id,name,slug,partner_type").order("name"),
      supabase.from("catalogue_sections").select("id,title,description,is_enabled,sort_order,collection_id,featured_movie_id,artwork_url").eq("id", "midnight-18").maybeSingle(),
    ]);
    const firstError = [g.error, c.error, i.error, p.error, cp.error, sectionResult.error].find(Boolean);
    if (firstError) onError(firstError.message);
    setGenres((g.data || []) as Option[]);
    setCollections((c.data || []) as Option[]);
    setIndustries((i.data || []) as Option[]);
    setPeople((p.data || []) as Option[]);
    setPartners((cp.data || []) as Option[]);
    if (sectionResult.data) {
      setSection({
        ...emptySection,
        ...sectionResult.data,
        description: sectionResult.data.description || "",
        collection_id: sectionResult.data.collection_id || "",
        featured_movie_id: sectionResult.data.featured_movie_id ? String(sectionResult.data.featured_movie_id) : "",
        artwork_url: sectionResult.data.artwork_url || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    if (!selectedMovieId) {
      setGenreIds([]);
      setCollectionIds([]);
      setIndustryIds([]);
      setPeopleCredits([]);
      setPartnerCredits([]);
      return;
    }
    let active = true;
    const loadAssignments = async () => {
      const [g, c, i, p, cp] = await Promise.all([
        supabase.from("movie_genres").select("genre_id").eq("movie_id", Number(selectedMovieId)),
        supabase.from("movie_collections").select("collection_id").eq("movie_id", Number(selectedMovieId)),
        supabase.from("movie_industries").select("industry_id").eq("movie_id", Number(selectedMovieId)),
        supabase.from("movie_people").select("person_id,role,character_name,billing_order").eq("movie_id", Number(selectedMovieId)).order("billing_order"),
        supabase.from("movie_content_partners").select("partner_id,role").eq("movie_id", Number(selectedMovieId)),
      ]);
      const firstError = [g.error, c.error, i.error, p.error, cp.error].find(Boolean);
      if (firstError) onError(firstError.message);
      if (!active) return;
      setGenreIds((g.data || []).map((row) => row.genre_id));
      setCollectionIds((c.data || []).map((row) => row.collection_id));
      setIndustryIds((i.data || []).map((row) => row.industry_id));
      setPeopleCredits((p.data || []).map((row) => ({
        person_id: row.person_id,
        role: row.role || "cast",
        character_name: row.character_name || "",
        billing_order: row.billing_order || undefined,
      })));
      setPartnerCredits((cp.data || []).map((row) => ({ partner_id: row.partner_id, role: row.role || "studio" })));
    };
    void loadAssignments();
    return () => { active = false; };
  }, [selectedMovieId]);

  const toggle = (values: string[], setValues: (next: string[]) => void, id: string) => {
    setValues(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  };

  const saveAssignments = async () => {
    if (!selectedMovieId) {
      onError("Choose a Midnight 18+ title first.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("pmf_replace_movie_metadata", {
      p_movie_id: Number(selectedMovieId),
      p_genre_ids: genreIds,
      p_collection_ids: collectionIds,
      p_industry_ids: industryIds,
      p_people: peopleCredits,
      p_partners: partnerCredits,
    });
    setSaving(false);
    if (error) {
      onError(error.message);
      return;
    }
    onNotice("Midnight title metadata and credits saved.");
  };

  const addOption = async () => {
    const name = newName.trim();
    const slug = slugify(name);
    if (!name || !slug) return;
    const prefix: Record<string, string> = {
      genre: "genre",
      collection: "collection",
      industry: "industry",
      person: "person",
      partner: "partner",
    };
    const table: Record<string, string> = {
      genre: "genres",
      collection: "collections",
      industry: "film_industries",
      person: "people",
      partner: "content_partners",
    };
    const id = `${prefix[newKind]}-${slug}`;
    const payload: Record<string, string> = { id, name, slug };
    if (newKind === "partner") payload.partner_type = newPartnerType;
    const { error } = await supabase.from(table[newKind]).insert(payload);
    if (error) {
      onError(error.message);
      return;
    }
    setNewName("");
    onNotice(`${name} added to catalogue metadata.`);
    await loadOptions();
  };

  const saveSection = async () => {
    setSaving(true);
    const { error } = await supabase.from("catalogue_sections").upsert({
      id: "midnight-18",
      title: section.title.trim() || "Midnight 18+",
      description: section.description.trim() || null,
      is_enabled: section.is_enabled,
      sort_order: Number(section.sort_order) || 0,
      collection_id: section.collection_id || null,
      featured_movie_id: section.featured_movie_id ? Number(section.featured_movie_id) : null,
      artwork_url: section.artwork_url.trim() || null,
      visibility: { profiles: ["adult"] },
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      onError(error.message);
      return;
    }
    onNotice("Midnight 18+ section settings saved.");
  };

  const updateSection = <K extends keyof SectionConfig>(key: K, value: SectionConfig[K]) => {
    setSection((current) => ({ ...current, [key]: value }));
  };

  const personIds = peopleCredits.map((credit) => credit.person_id);
  const partnerIds = partnerCredits.map((credit) => credit.partner_id);

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">Loading Midnight management data…</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#100c17] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white">Midnight 18+ Section Controls</h3>
            <p className="mt-1 text-xs text-white/50">Manage the existing vault's visibility, presentation and featured title.</p>
          </div>
          <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-[10px] font-bold text-violet-200">{midnightMovies.length} tagged titles</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-white/60">Section title
            <input className={inputClass} value={section.title} onChange={(e) => updateSection("title", e.target.value)} />
          </label>
          <label className="space-y-1 text-xs text-white/60">Display order
            <input className={inputClass} type="number" value={section.sort_order} onChange={(e) => updateSection("sort_order", Number(e.target.value))} />
          </label>
          <label className="space-y-1 text-xs text-white/60 sm:col-span-2">Description
            <textarea className={inputClass} rows={2} value={section.description} onChange={(e) => updateSection("description", e.target.value)} />
          </label>
          <label className="space-y-1 text-xs text-white/60">Featured title
            <select className={inputClass} value={section.featured_movie_id} onChange={(e) => updateSection("featured_movie_id", e.target.value)}>
              <option value="">No featured title</option>
              {midnightMovies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title || `Movie ${movie.id}`}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-white/60">Collection
            <select className={inputClass} value={section.collection_id} onChange={(e) => updateSection("collection_id", e.target.value)}>
              <option value="">No collection</option>
              {collections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-white/60 sm:col-span-2">Featured artwork URL
            <input className={inputClass} value={section.artwork_url} onChange={(e) => updateSection("artwork_url", e.target.value)} placeholder="Supabase Storage image URL" />
          </label>
          <label className="flex items-center gap-2 text-xs text-white/70 sm:col-span-2">
            <input type="checkbox" checked={section.is_enabled} onChange={(e) => updateSection("is_enabled", e.target.checked)} />
            Enable Midnight 18+ section
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button className={buttonClass} disabled={saving} onClick={() => void saveSection()}>{saving ? "Saving…" : "Save section settings"}</button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#100c17] p-4 sm:p-6">
        <h3 className="text-lg font-black text-white">Movie Metadata, Genres & Credits</h3>
        <p className="mt-1 text-xs text-white/50">Choose a title, then assign only verified genres, collections, industries, people and partners.</p>
        <label className="mt-4 block space-y-1 text-xs text-white/60">Midnight title
          <select className={inputClass} value={selectedMovieId} onChange={(e) => setSelectedMovieId(e.target.value)}>
            <option value="">Select a Midnight 18+ title</option>
            {midnightMovies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title || `Movie ${movie.id}`}</option>)}
          </select>
        </label>
        {!midnightMovies.length ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">No Midnight 18+ titles have been created yet. Create a real title in PMF Studio and mark it Midnight 18+ first.</p>
        ) : selectedMovieId ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {[
              { title: "Genres", items: genres, values: genreIds, set: setGenreIds },
              { title: "Collections", items: collections, values: collectionIds, set: setCollectionIds },
              { title: "Film industries / regions", items: industries, values: industryIds, set: setIndustryIds },
            ].map((group) => (
              <div key={group.title} className="rounded-xl border border-white/10 p-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/70">{group.title}</h4>
                <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
                  {group.items.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-xs text-white/70">
                      <input type="checkbox" checked={group.values.includes(item.id)} onChange={() => toggle(group.values, group.set, item.id)} />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-white/10 p-3">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/70">Cast & performer credits</h4>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
                {people.map((person) => (
                  <label key={person.id} className="flex items-center gap-2 text-xs text-white/70">
                    <input type="checkbox" checked={personIds.includes(person.id)} onChange={() => setPeopleCredits((current) => personIds.includes(person.id) ? current.filter((item) => item.person_id !== person.id) : [...current, { person_id: person.id, role: "cast" }])} />
                    <span>{person.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 p-3">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/70">Studios, publishers & distributors</h4>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
                {partners.map((partner) => (
                  <label key={partner.id} className="flex items-center gap-2 text-xs text-white/70">
                    <input type="checkbox" checked={partnerIds.includes(partner.id)} onChange={() => setPartnerCredits((current) => partnerIds.includes(partner.id) ? current.filter((item) => item.partner_id !== partner.id) : [...current, { partner_id: partner.id, role: partner.partner_type || "studio" }])} />
                    <span>{partner.name} <span className="text-white/35">({partner.partner_type})</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end lg:col-span-2">
              <button className={buttonClass} disabled={saving} onClick={() => void saveAssignments()}>{saving ? "Saving…" : "Save movie metadata & credits"}</button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#100c17] p-4 sm:p-6">
        <h3 className="text-lg font-black text-white">Manage Metadata Library</h3>
        <p className="mt-1 text-xs text-white/50">Add genuine entries. Nothing is automatically invented or attached to a movie.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_1fr_auto]">
          <select className={inputClass} value={newKind} onChange={(e) => setNewKind(e.target.value)}>
            <option value="genre">Genre</option>
            <option value="collection">Collection</option>
            <option value="industry">Film industry</option>
            <option value="person">Performer / person</option>
            <option value="partner">Studio / publisher</option>
          </select>
          <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
          {newKind === "partner" ? (
            <select className={inputClass} value={newPartnerType} onChange={(e) => setNewPartnerType(e.target.value)}>
              <option value="studio">Studio</option>
              <option value="publisher">Publisher</option>
              <option value="network">Network</option>
              <option value="distributor">Distributor</option>
            </select>
          ) : <div className="hidden sm:block" />}
          <button className={buttonClass} onClick={() => void addOption()}>Add entry</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/50">
          <span>{genres.length} genres</span><span>•</span>
          <span>{collections.length} collections</span><span>•</span>
          <span>{industries.length} industries</span><span>•</span>
          <span>{people.length} people</span><span>•</span>
          <span>{partners.length} partners</span>
        </div>
      </section>
    </div>
  );
}
