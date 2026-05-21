import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BedDouble,
  Bot,
  CalendarDays,
  ChevronRight,
  Hotel,
  LayoutDashboard,
  ListFilter,
  Loader2,
  LogIn,
  LogOut,
  Map,
  MessageSquare,
  Send,
  Shield,
  Sparkles,
  Star,
  UserRound
} from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { supabase } from "./supabase";
import { apiFetch } from "./api";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

const cityImages = {
  Rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80",
  Bodrum: "https://images.unsplash.com/photo-1604841956658-017c1d3dbd28?auto=format&fit=crop&w=1200&q=80",
  Istanbul: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=80",
  Paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80"
};

const now = new Date();
const tomorrow = new Date(now);
tomorrow.setDate(now.getDate() + 1);
const afterTomorrow = new Date(now);
afterTomorrow.setDate(now.getDate() + 3);

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function currency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("app:navigate"));
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener("app:navigate", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("app:navigate", update);
    };
  }, []);
  return path;
}

function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

function Header({ session }) {
  const isAdmin = session?.user?.app_metadata?.role === "admin";
  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <button className="flex items-center gap-3" onClick={() => navigate("/")}>
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-900 text-stone-50">
            <Hotel size={22} />
          </span>
          <span className="text-left">
            <span className="block font-serif text-xl font-semibold text-stone-950">StaySE</span>
            <span className="block text-xs uppercase tracking-[0.18em] text-stone-500">Micro hotel desk</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          <NavButton path="/" label="Search" icon={<ListFilter size={17} />} />
          <NavButton path="/my-bookings" label="Bookings" icon={<CalendarDays size={17} />} />
          {isAdmin && <NavButton path="/admin" label="Admin" icon={<LayoutDashboard size={17} />} />}
        </nav>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              <span className="hidden max-w-48 truncate text-sm text-stone-600 sm:inline">{session.user.email}</span>
              <button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={18} /></button>
            </>
          ) : (
            <button className="command-button" onClick={() => navigate("/login")}><LogIn size={17} />Login</button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavButton({ path, label, icon }) {
  return <button className="nav-button" onClick={() => navigate(path)}>{icon}{label}</button>;
}

function SearchPage({ session }) {
  const [form, setForm] = useState({ city: "Rome", start_date: isoDate(tomorrow), end_date: isoDate(afterTomorrow), guests: 2 });
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState("");

  async function searchHotels(event) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ ...form, page: "1", limit: "12" });
      const data = await apiFetch(`/api/v1/search/hotels/search?${query}`, { session });
      setResults(data.data || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    searchHotels();
  }, [session?.access_token]);

  return (
    <main className="page-shell">
      <section className="search-band">
        <div className="search-copy">
          <p className="eyebrow">Vacancy aware hotel search</p>
          <h1 className="font-serif text-4xl font-semibold leading-tight text-stone-950 md:text-6xl">Find a room that is actually open.</h1>
          <p className="max-w-2xl text-base text-stone-600 md:text-lg">Live availability, member prices, maps, comments, bookings, and an AI assistant are all behind one gateway.</p>
        </div>
        <form className="search-panel" onSubmit={searchHotels}>
          <label>City<select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}><option>Rome</option><option>Bodrum</option><option>Istanbul</option><option>Paris</option></select></label>
          <label>Check-in<input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
          <label>Check-out<input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
          <label>Guests<input type="number" min="1" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} /></label>
          <button className="primary-button" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}Ara</button>
        </form>
      </section>

      <section className="content-strip">
        <div className="section-head">
          <div>
            <p className="eyebrow">Results</p>
            <h2 className="font-serif text-3xl font-semibold text-stone-950">{total} available stays</h2>
          </div>
          <button className="command-button" onClick={() => setShowMap(!showMap)}>{showMap ? <BedDouble size={17} /> : <Map size={17} />}{showMap ? "List" : "Haritada goster"}</button>
        </div>
        {error && <div className="notice error">{error}</div>}
        {showMap ? <HotelMap hotels={results} /> : <HotelGrid hotels={results} session={session} />}
      </section>
    </main>
  );
}

function HotelGrid({ hotels, session }) {
  if (!hotels.length) return <div className="empty-state">No stays found for this search.</div>;
  return (
    <div className="hotel-grid">
      {hotels.map((hotel) => (
        <article className="hotel-card" key={hotel.hotel_id || hotel.id}>
          <img src={cityImages[hotel.city] || cityImages.Rome} alt={`${hotel.city} hotel`} />
          <div className="hotel-card-body">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-2xl font-semibold text-stone-950">{hotel.name}</h3>
                <p className="text-sm text-stone-500">{hotel.city}, {hotel.country}</p>
              </div>
              <span className="rating"><Star size={15} fill="currentColor" /> {hotel.rating || "-"}</span>
            </div>
            <p className="line-clamp-2 min-h-12 text-sm text-stone-600">{hotel.description}</p>
            <div className="flex flex-wrap gap-2">{(hotel.amenities || []).slice(0, 4).map((item) => <span className="tag" key={item}>{item}</span>)}</div>
            <div className="flex items-end justify-between gap-4">
              <div>
                {session && hotel.discounted_min_price ? <p className="member-badge">Uye Fiyati: %15 indirim</p> : null}
                <p className="price">{currency(hotel.discounted_min_price || hotel.min_price_per_night)}</p>
                <p className="text-xs text-stone-500">per night from</p>
              </div>
              <button className="arrow-button" onClick={() => navigate(`/hotels/${hotel.hotel_id || hotel.id}`)}>Details <ChevronRight size={17} /></button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function HotelMap({ hotels }) {
  const valid = hotels.filter((hotel) => hotel.lat && hotel.lng);
  const center = valid[0] ? [valid[0].lat, valid[0].lng] : [41.9028, 12.4964];
  return (
    <div className="map-shell">
      <MapContainer center={center} zoom={valid.length === 1 ? 12 : 5} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {valid.map((hotel) => (
          <Marker key={hotel.hotel_id || hotel.id} position={[hotel.lat, hotel.lng]}>
            <Popup><strong>{hotel.name}</strong><br />{currency(hotel.discounted_min_price || hotel.min_price_per_night)}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function HotelDetailPage({ session, id }) {
  const [hotel, setHotel] = useState(null);
  const [comments, setComments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [commentForm, setCommentForm] = useState({ text: "", ratings: { cleanliness: 5, staff: 5, amenities: 5, location: 5, eco_friendly: 5 } });

  async function load() {
    const [detail, commentList, commentSummary] = await Promise.all([
      apiFetch(`/api/v1/search/hotels/${id}`),
      apiFetch(`/api/v1/comments/hotels/${id}/comments?page=1&limit=8`),
      apiFetch(`/api/v1/comments/hotels/${id}/comments/summary`)
    ]);
    setHotel(detail);
    setComments(commentList.data || []);
    setSummary(commentSummary);
  }

  useEffect(() => { load().catch((e) => setMessage(e.message)); }, [id]);

  async function reserve(room) {
    if (!session) return navigate("/login");
    try {
      const booking = await apiFetch("/api/v1/bookings/bookings", {
        method: "POST",
        session,
        body: { room_id: room.id, start_date: isoDate(tomorrow), end_date: isoDate(afterTomorrow), guests: 1 }
      });
      setMessage(`Reservation #${booking.id} confirmed.`);
    } catch (e) {
      setMessage(e.message);
    }
  }

  async function postComment(event) {
    event.preventDefault();
    try {
      await apiFetch(`/api/v1/comments/hotels/${id}/comments`, { method: "POST", session, body: commentForm });
      setCommentForm({ ...commentForm, text: "" });
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  }

  if (!hotel) return <LoadingPage />;

  return (
    <main className="page-shell">
      <section className="detail-hero">
        <img src={cityImages[hotel.city] || cityImages.Rome} alt={`${hotel.city} stay`} />
        <div>
          <p className="eyebrow">{hotel.city}, {hotel.country}</p>
          <h1 className="font-serif text-5xl font-semibold text-stone-950">{hotel.name}</h1>
          <p className="mt-4 max-w-2xl text-stone-600">{hotel.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">{(hotel.amenities || []).map((item) => <span className="tag" key={item}>{item}</span>)}</div>
        </div>
      </section>
      {message && <div className="notice">{message}</div>}
      <section className="split-layout">
        <div>
          <div className="section-head"><h2 className="font-serif text-3xl font-semibold">Rooms</h2></div>
          <div className="stack">
            {hotel.rooms.map((room) => (
              <article className="room-row" key={room.id}>
                <div><h3 className="text-lg font-semibold">{room.room_type}</h3><p className="text-sm text-stone-500">Capacity {room.capacity} · {room.total_count} rooms</p></div>
                <div className="text-right"><p className="price compact">{currency(room.price_per_night)}</p><button className="primary-button slim" onClick={() => reserve(room)}>Rezervasyon yap</button></div>
              </article>
            ))}
          </div>
        </div>
        <aside className="summary-panel">
          <h2 className="font-serif text-2xl font-semibold">Guest signal</h2>
          <p className="mb-4 text-sm text-stone-500">{summary?.total || 0} verified comments</p>
          <p className="mb-5 text-4xl font-semibold text-emerald-900">{summary?.average_overall || "-"}</p>
          {summary?.averages && Object.entries(summary.averages).map(([key, value]) => (
            <div className="score-row" key={key}><span>{key.replace("_", " ")}</span><div><span style={{ width: `${(Number(value || 0) / 5) * 100}%` }} /></div><strong>{value || "-"}</strong></div>
          ))}
        </aside>
      </section>
      <section className="content-strip">
        <div className="section-head"><h2 className="font-serif text-3xl font-semibold">Comments</h2></div>
        <div className="comment-grid">{comments.map((comment) => <article className="comment-card" key={comment.id}><p className="text-sm text-stone-600">{comment.text}</p><p className="mt-3 text-xs uppercase tracking-[0.16em] text-stone-400">{comment.user_country || "Guest"}</p></article>)}</div>
        {session && <form className="comment-form" onSubmit={postComment}><textarea value={commentForm.text} onChange={(e) => setCommentForm({ ...commentForm, text: e.target.value })} placeholder="Share a verified stay note" /><button className="primary-button"><MessageSquare size={17} /> Post comment</button></form>}
      </section>
    </main>
  );
}

function AuthPage({ mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    const action = mode === "register" ? supabase.auth.signUp({ email, password }) : supabase.auth.signInWithPassword({ email, password });
    const { error } = await action;
    if (error) setMessage(error.message);
    else navigate("/");
  }
  return (
    <main className="auth-shell">
      <form className="auth-panel" onSubmit={submit}>
        <p className="eyebrow">{mode === "register" ? "Create account" : "Welcome back"}</p>
        <h1 className="font-serif text-4xl font-semibold">{mode === "register" ? "Register" : "Login"}</h1>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
        {message && <div className="notice error">{message}</div>}
        <button className="primary-button"><UserRound size={17} /> {mode === "register" ? "Register" : "Login"}</button>
        <button type="button" className="link-button" onClick={() => navigate(mode === "register" ? "/login" : "/register")}>{mode === "register" ? "I already have an account" : "Create a new account"}</button>
      </form>
    </main>
  );
}

function MyBookingsPage({ session }) {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!session) return;
    apiFetch("/api/v1/bookings/bookings/me?page=1&limit=20", { session }).then((data) => {
      setBookings(data.data || []);
      setTotal(data.total || 0);
    });
  }, [session]);
  if (!session) return <AuthRequired />;
  return <main className="page-shell"><section className="content-strip"><p className="eyebrow">My trips</p><h1 className="font-serif text-4xl font-semibold">{total} bookings</h1><div className="stack mt-6">{bookings.map((booking) => <article className="room-row" key={booking.id}><div><h3 className="text-lg font-semibold">{booking.hotel_name}</h3><p className="text-sm text-stone-500">{booking.room_type} · {booking.start_date?.slice(0, 10)} - {booking.end_date?.slice(0, 10)}</p></div><p className="price compact">{currency(booking.total_price)}</p></article>)}{!bookings.length && <div className="empty-state">No bookings yet.</div>}</div></section></main>;
}

function AdminPage({ session }) {
  const [hotels, setHotels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [message, setMessage] = useState("");
  const [hotelForm, setHotelForm] = useState({ name: "", city: "Rome", country: "Italy", address: "", lat: "", lng: "", description: "", rating: 4.5, amenities: "wifi, breakfast" });
  const [roomForm, setRoomForm] = useState({ hotel_id: "", room_type: "", capacity: 2, price_per_night: 120, total_count: 1 });
  const [availability, setAvailability] = useState({ room_id: "", start_date: isoDate(tomorrow), end_date: isoDate(afterTomorrow), is_available: true });

  async function load() {
    const [hotelData, roomData] = await Promise.all([apiFetch("/api/v1/admin/hotels?page=1&limit=50", { session }), apiFetch("/api/v1/admin/rooms?page=1&limit=50", { session })]);
    setHotels(hotelData.data || []);
    setRooms(roomData.data || []);
  }
  useEffect(() => { if (session) load().catch((e) => setMessage(e.message)); }, [session]);
  if (!session) return <AuthRequired />;

  async function createHotel(event) {
    event.preventDefault();
    await apiFetch("/api/v1/admin/hotels", { method: "POST", session, body: { ...hotelForm, lat: Number(hotelForm.lat), lng: Number(hotelForm.lng), rating: Number(hotelForm.rating), amenities: hotelForm.amenities.split(",").map((item) => item.trim()).filter(Boolean) } });
    setMessage("Hotel created.");
    await load();
  }
  async function createRoom(event) {
    event.preventDefault();
    await apiFetch("/api/v1/admin/rooms", { method: "POST", session, body: { ...roomForm, hotel_id: Number(roomForm.hotel_id) } });
    setMessage("Room created.");
    await load();
  }
  async function updateAvailability(event) {
    event.preventDefault();
    await apiFetch(`/api/v1/admin/rooms/${availability.room_id}/availability`, { method: "PUT", session, body: availability });
    setMessage("Availability updated.");
  }

  return (
    <main className="page-shell">
      <section className="content-strip">
        <p className="eyebrow">Admin cockpit</p>
        <h1 className="font-serif text-4xl font-semibold">Inventory control</h1>
        {message && <div className="notice">{message}</div>}
        <div className="admin-grid">
          <AdminForm title="Hotel" onSubmit={createHotel}>{["name", "city", "country", "address", "lat", "lng", "description", "rating", "amenities"].map((key) => <input key={key} placeholder={key} value={hotelForm[key]} onChange={(e) => setHotelForm({ ...hotelForm, [key]: e.target.value })} />)}</AdminForm>
          <AdminForm title="Room" onSubmit={createRoom}><select value={roomForm.hotel_id} onChange={(e) => setRoomForm({ ...roomForm, hotel_id: e.target.value })}><option value="">hotel</option>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select>{["room_type", "capacity", "price_per_night", "total_count"].map((key) => <input key={key} placeholder={key} value={roomForm[key]} onChange={(e) => setRoomForm({ ...roomForm, [key]: e.target.value })} />)}</AdminForm>
          <AdminForm title="Availability" onSubmit={updateAvailability}><select value={availability.room_id} onChange={(e) => setAvailability({ ...availability, room_id: e.target.value })}><option value="">room</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.hotel_name} · {room.room_type}</option>)}</select><input type="date" value={availability.start_date} onChange={(e) => setAvailability({ ...availability, start_date: e.target.value })} /><input type="date" value={availability.end_date} onChange={(e) => setAvailability({ ...availability, end_date: e.target.value })} /><label className="check-row"><input type="checkbox" checked={availability.is_available} onChange={(e) => setAvailability({ ...availability, is_available: e.target.checked })} /> available</label></AdminForm>
        </div>
      </section>
    </main>
  );
}

function AdminForm({ title, onSubmit, children }) {
  return <form className="admin-form" onSubmit={onSubmit}><h2 className="font-serif text-2xl font-semibold">{title}</h2>{children}<button className="primary-button slim"><Shield size={17} /> Save</button></form>;
}

function AIWidget({ session }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: "Merhaba. Search, reviews, rooms and booking can run through me." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(event) {
    event.preventDefault();
    if (!input.trim()) return;
    const nextMessages = [...messages, { role: "user", content: input.trim() }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const result = await apiFetch("/api/v1/ai/chat", { method: "POST", session, body: { messages: nextMessages.filter((message) => message.role !== "assistant" || message.content !== messages[0].content) } });
      setMessages([...nextMessages, { role: "assistant", content: result.assistant_message || "Done." }]);
    } catch (e) {
      setMessages([...nextMessages, { role: "assistant", content: e.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`ai-widget ${open ? "open" : ""}`}>
      {open && <div className="ai-panel"><div className="ai-head"><Bot size={18} /> Stay assistant</div><div className="ai-messages">{messages.map((message, index) => <div className={`bubble ${message.role}`} key={index}>{message.content}</div>)}{loading && <div className="bubble assistant">Thinking...</div>}</div><form className="ai-form" onSubmit={send}><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask for Rome availability" /><button><Send size={16} /></button></form></div>}
      <button className="ai-toggle" onClick={() => setOpen(!open)} title="AI chat"><Bot size={22} /></button>
    </div>
  );
}

function AuthRequired() {
  return <main className="auth-shell"><div className="auth-panel"><LogIn size={28} /><h1 className="font-serif text-3xl font-semibold">Login required</h1><button className="primary-button" onClick={() => navigate("/login")}>Login</button></div></main>;
}

function LoadingPage() {
  return <main className="auth-shell"><Loader2 className="animate-spin text-emerald-900" size={32} /></main>;
}

function App() {
  const path = useRoute();
  const { session, loading } = useSession();
  const route = useMemo(() => {
    if (path.startsWith("/hotels/")) return { name: "hotel", id: path.split("/")[2] };
    if (path === "/login") return { name: "login" };
    if (path === "/register") return { name: "register" };
    if (path === "/my-bookings") return { name: "bookings" };
    if (path === "/admin") return { name: "admin" };
    return { name: "search" };
  }, [path]);

  if (loading) return <LoadingPage />;
  return (
    <>
      <Header session={session} />
      {route.name === "search" && <SearchPage session={session} />}
      {route.name === "hotel" && <HotelDetailPage session={session} id={route.id} />}
      {route.name === "login" && <AuthPage mode="login" />}
      {route.name === "register" && <AuthPage mode="register" />}
      {route.name === "bookings" && <MyBookingsPage session={session} />}
      {route.name === "admin" && <AdminPage session={session} />}
      <AIWidget session={session} />
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
