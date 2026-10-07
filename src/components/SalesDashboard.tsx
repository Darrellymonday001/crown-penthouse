const API_URL = import.meta.env.VITE_API_URL || '';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Clock3, CreditCard, Eye, LayoutDashboard, LogOut, Search, ShieldCheck, Users } from 'lucide-react';
import { ApplicantRecord } from '../data/applicationStore';
// import API_URL from "../api";

interface SalesDashboardProps { onBack: () => void; }
type AdminRecord = ApplicantRecord & { paymentOrder: { orderId: string; paymentId: string | null; paymentStatus: string; priceAmount: string; priceCurrency: string; payCurrency: string } | null };
type DocumentRow = { id: number; documentType: string; originalName: string; mimeType: string; fileSize: number; uploadedAt: string };
type ConversationRow = { sender: string; message: string; createdAt: string };
const statusStyles: Record<string, string> = { NEW: 'text-cyan-300 bg-cyan-300/10 border-cyan-300/20', 'UNDER REVIEW': 'text-amber-300 bg-amber-300/10 border-amber-300/20', 'PAYMENT PENDING': 'text-orange-300 bg-orange-300/10 border-orange-300/20', 'PAYMENT VERIFIED': 'text-emerald-300 bg-emerald-300/10 border-emerald-300/20' };

export const SalesDashboard: React.FC<SalesDashboardProps> = ({ onBack }) => {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [selected, setSelected] = useState<AdminRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [conversation, setConversation] = useState<ConversationRow[]>([]);
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const response = await fetch('${API_URL}/api/admin/applications', { credentials: 'include' });
    if (response.status === 401) { setAuthenticated(false); return; }
    const result = await response.json();
    if (!response.ok) { setError(result.message || 'Could not load applications.'); return; }
    setAuthenticated(true);
    setRecords(result.applications);
    setSelected((current) => current ? result.applications.find((item: AdminRecord) => item.applicationId === current.applicationId) || null : null);
  };

  useEffect(() => { void fetch('${API_URL}/api/admin/me', { credentials: 'include' }).then((response) => { setAuthenticated(response.ok); if (response.ok) void load(); }).catch(() => setAuthenticated(false)); }, []);
  useEffect(() => { if (!authenticated) return undefined; const timer = window.setInterval(() => void load(), 15000); return () => window.clearInterval(timer); }, [authenticated]);
  useEffect(() => {
    if (!selected) { setDocuments([]); setConversation([]); return undefined; }
    const refreshDetails = () => {
      void fetch(`${API_URL}/api/admin/applications/${encodeURIComponent(selected.applicationId)}/documents`, { credentials: 'include' }).then((response) => response.json()).then((result) => setDocuments(result.documents || [])).catch(() => setDocuments([]));
      void fetch(`${API_URL}/api/admin/applications/${encodeURIComponent(selected.applicationId)}/conversation`, { credentials: 'include' }).then((response) => response.json()).then((result) => setConversation(result.conversationHistory || [])).catch(() => setConversation([]));
    };
    refreshDetails();
    const timer = window.setInterval(refreshDetails, 15000);
    return () => window.clearInterval(timer);
  }, [selected?.applicationId]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const response = await fetch('${API_URL}/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message || 'Login failed.'); return; }
      setAuthenticated(true); await load();
    } catch { setError('Admin API is unavailable.'); }
  };
  const logout = async () => { await fetch('${API_URL}/api/admin/logout', { method: 'POST', credentials: 'include' }); setAuthenticated(false); setRecords([]); setSelected(null); };

  if (authenticated === null) return <div className="min-h-screen bg-[#101010] p-12 text-center text-gray-400">Checking private access...</div>;
  if (!authenticated) return <section className="min-h-screen bg-[#101010] px-4 py-16 sm:px-8"><div className="mx-auto max-w-md border border-[#C5A059]/25 bg-[#191919] p-8"><button onClick={onBack} className="mb-10 inline-flex items-center gap-2 text-sm text-[#C5A059]"><ArrowLeft className="h-4 w-4" /> Return to residences</button><ShieldCheck className="mb-5 h-9 w-9 text-[#C5A059]" /><h1 className="font-serif-luxury text-4xl text-white">Admin sign in</h1><p className="mt-3 text-sm leading-6 text-gray-500">This area is restricted to authorized Crown sales administrators.</p><form onSubmit={login} className="mt-8 space-y-5"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" className="w-full border border-white/10 bg-[#101010] p-3 text-sm text-white outline-none focus:border-[#C5A059]" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full border border-white/10 bg-[#101010] p-3 text-sm text-white outline-none focus:border-[#C5A059]" />{error && <p className="text-sm text-red-300">{error}</p>}<button className="gold-gradient w-full p-3 text-sm font-semibold text-[#121212]">Sign in securely</button></form></div></section>;

  const filtered = records.filter((record) => `${record.name} ${record.email} ${record.applicationId}`.toLowerCase().includes(query.toLowerCase()));
  const count = (status: string) => records.filter((record) => record.applicationStatus === status).length;
  const metrics: [string, number, React.ElementType][] = [['New Applications', count('NEW'), Users], ['Under Review', count('UNDER REVIEW'), Clock3], ['Payment Pending', count('PAYMENT PENDING'), CreditCard], ['Payments Verified', count('PAYMENT VERIFIED'), ShieldCheck], ['Reservations', count('RESIDENCE RESERVED'), Eye]];

  return <section className="min-h-screen bg-[#101010] px-4 py-10 sm:px-8 lg:px-12"><div className="mx-auto max-w-7xl">
    <div className="mb-8 flex items-center justify-between"><button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-[#C5A059]"><ArrowLeft className="h-4 w-4" /> Return to residences</button><button onClick={logout} className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button></div>
    <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-[#C5A059]"><LayoutDashboard className="h-4 w-4" /> Private operations</div><h1 className="font-serif-luxury text-4xl text-white sm:text-5xl">Crown Sales Dashboard</h1><p className="mt-3 text-sm text-gray-400">Authenticated applications, payment status, and submitted documents.</p></div><div className="flex items-center gap-2 text-xs text-emerald-300"><ShieldCheck className="h-4 w-4" /> Database connected</div></div>
    <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">{metrics.map(([label, value, Icon]) => <div key={label} className="border border-white/10 bg-[#191919] p-5"><Icon className="mb-6 h-5 w-5 text-[#C5A059]" /><div className="text-3xl font-semibold text-white">{value}</div><div className="mt-1 text-xs uppercase tracking-wider text-gray-500">{label}</div></div>)}</div>
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]"><div className="overflow-hidden border border-white/10 bg-[#191919]"><div className="flex items-center justify-between gap-4 border-b border-white/10 p-5"><h2 className="font-serif-luxury text-2xl text-white">Applications</h2><label className="flex w-52 items-center gap-2 border border-white/10 px-3 py-2 text-xs text-gray-400"><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applicants" className="w-full bg-transparent outline-none placeholder:text-gray-600" /></label></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-white/10 text-[10px] uppercase tracking-widest text-gray-500"><tr><th className="p-4">Applicant</th><th className="p-4">Residence</th><th className="p-4">Payment</th><th className="p-4">Status</th><th /></tr></thead><tbody>{filtered.map((record) => <tr key={record.applicationId} onClick={() => setSelected(record)} className="cursor-pointer border-b border-white/5 text-gray-300 hover:bg-white/3"><td className="p-4"><div className="font-medium text-white">{record.name}</div><div className="mt-1 text-xs text-gray-500">{record.applicationId}</div></td><td className="p-4">{record.residence}</td><td className="p-4">{record.paymentOrder ? `${record.paymentOrder.payCurrency.toUpperCase()} · ${record.paymentOrder.paymentStatus}` : 'Not started'}</td><td className="p-4"><span className={`border px-2 py-1 text-[10px] ${statusStyles[record.applicationStatus] || 'text-gray-300'}`}>{record.applicationStatus}</span></td><td className="p-4 text-[#C5A059]"><ChevronRight className="h-4 w-4" /></td></tr>)}{!filtered.length && <tr><td colSpan={5} className="p-12 text-center text-sm text-gray-500">No applications found.</td></tr>}</tbody></table></div></div>
    <aside className="border border-[#C5A059]/20 bg-[#191919] p-6">{selected ? <><div className="mb-6"><div className="text-xs uppercase tracking-widest text-[#C5A059]">Applicant record</div><h2 className="mt-2 font-serif-luxury text-3xl text-white">{selected.name}</h2><p className="mt-1 font-mono text-xs text-gray-500">{selected.applicationId}</p></div><div className="space-y-2 border-y border-white/10 py-5 text-sm text-gray-300"><a className="text-[#C5A059] underline" href={`mailto:${selected.email}`}>{selected.email}</a><br />{selected.phone}<br />{selected.residence}<br />{selected.purchaseIntent}<br />Payment: {selected.paymentOrder ? `${selected.paymentOrder.priceCurrency} ${selected.paymentOrder.priceAmount} via ${selected.paymentOrder.payCurrency} (${selected.paymentOrder.paymentStatus})` : 'Not started'}</div><h3 className="mt-6 text-xs uppercase tracking-wider text-[#C5A059]">Applicant documents</h3><div className="mt-3 space-y-2">{documents.length ? documents.map((document) => <a key={document.id} href={`/api/admin/documents/${document.id}`} className="flex items-center justify-between border border-white/10 p-3 text-xs text-gray-200 hover:border-[#C5A059]"><span>{document.documentType}: {document.originalName}</span><span className="text-gray-500">{new Date(document.uploadedAt).toLocaleDateString()}</span></a>) : <p className="text-xs text-gray-500">No documents uploaded.</p>}</div><h3 className="mt-6 text-xs uppercase tracking-wider text-[#C5A059]">Concierge conversation</h3><div className="mt-3 max-h-60 space-y-3 overflow-y-auto">{conversation.map((entry, index) => <div key={`${entry.createdAt}-${index}`} className="border-l border-[#C5A059]/40 pl-3"><div className="text-[10px] uppercase tracking-wider text-gray-600">{entry.sender}</div><p className="mt-1 text-xs leading-5 text-gray-300">{entry.message}</p></div>)}</div></> : <div className="flex min-h-72 flex-col items-center justify-center text-center"><Users className="mb-4 h-8 w-8 text-[#C5A059]" /><h2 className="font-serif-luxury text-2xl text-white">Select an applicant</h2><p className="mt-2 text-sm text-gray-500">Application email, NOWPayments status, and private documents appear here.</p></div>}</aside></div>
  </div></section>;
};
