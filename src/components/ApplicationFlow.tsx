import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, LockKeyhole, ShieldCheck } from 'lucide-react';
import { ApartmentData } from '../data/apartmentData';
import { ApplicantRecord, ConversationEntry } from '../data/applicationStore';
import API_URL from "../api";

interface ApplicationFlowProps { data: ApartmentData; onComplete: (record: ApplicantRecord) => void; }
type Step = 'welcome' | 'name' | 'email' | 'phone' | 'intent' | 'payment' | 'verification' | 'summary' | 'submitted';
type Coin = { label: string; code: string };
const intents = ['Ready to Proceed', 'Shortlisting a Residence', 'Requesting More Information', 'Exploring Investment Opportunities'];
const coins: Coin[] = [{ label: 'Bitcoin', code: 'btc' }, { label: 'Ethereum', code: 'eth' }, { label: 'Solana', code: 'sol' }, { label: 'USDT (TRC20)', code: 'usdttrc20' }];
const requestedApplication = typeof window === 'undefined' ? null : { id: new URLSearchParams(window.location.search).get('application'), access: new URLSearchParams(window.location.search).get('access') };
type StatusResponse = { application: ApplicantRecord & { portalAccess: boolean; paymentOrder: { paymentStatus: string; invoiceUrl: string | null } | null } };

export const ApplicationFlow: React.FC<ApplicationFlowProps> = ({ data, onComplete }) => {
  const [step, setStep] = useState<Step>(requestedApplication?.id && requestedApplication.access ? 'submitted' : 'welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [intent, setIntent] = useState('');
  const [coin, setCoin] = useState<Coin>(coins[0]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [applicationId, setApplicationId] = useState(requestedApplication?.id || '');
  const [accessToken, setAccessToken] = useState(requestedApplication?.access || '');
  const [paymentStatus, setPaymentStatus] = useState('NOT STARTED');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ConversationEntry[]>([]);
  const applicantName = name.trim() || 'Applicant';
  const record = useMemo<ApplicantRecord>(() => ({ applicationId, name, email, phone, residence: data.title, budgetRange: data.price, purchaseIntent: intent, paymentPreference: coin.label, applicationStatus: 'NEW', paymentStatus: 'NOT REQUESTED', salesRepresentative: 'Crown Sales Concierge', createdAt: new Date().toISOString(), conversationHistory: history }), [applicationId, name, email, phone, data.title, data.price, intent, coin, history]);
  const appendMessage = (sender: ConversationEntry['sender'], message: string) => setHistory((items) => [...items, { sender, message, createdAt: new Date().toISOString() }]);
  const setPrivateUrl = (id: string, token: string) => window.history.replaceState(null, '', `${window.location.origin}/tenant-portal.html?application=${encodeURIComponent(id)}&access=${encodeURIComponent(token)}`);

  const submitApplication = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Application could not be submitted.');
      setApplicationId(result.applicationId); setAccessToken(result.accessToken); setPrivateUrl(result.applicationId, result.accessToken);
      sessionStorage.setItem('crown_application_access', JSON.stringify({ applicationId: result.applicationId, accessToken: result.accessToken }));
      onComplete({ ...record, applicationId: result.applicationId, applicationStatus: 'UNDER REVIEW' });
      setStep('submitted');
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Application could not be submitted.'); }
    finally { setBusy(false); }
  };

  const beginCheckout = async () => {
    if (!applicationId || !accessToken) return setError('Open your private application link to continue.');
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ payCurrency: coin.code }) });
      const result = await response.json();
      if (!response.ok || !result.invoiceUrl) throw new Error(result.message || 'Secure checkout could not be started.');
      setInvoiceUrl(result.invoiceUrl); window.location.assign(result.invoiceUrl);
    } catch (paymentError) { setError(paymentError instanceof Error ? paymentError.message : 'Secure checkout could not be started.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!applicationId) return undefined;
    const saved = sessionStorage.getItem('crown_application_access');
    const token = accessToken || requestedApplication?.access || (saved ? (JSON.parse(saved) as { accessToken?: string }).accessToken || '' : '');
    if (!token) return undefined;
    setAccessToken(token); sessionStorage.setItem('crown_application_access', JSON.stringify({ applicationId, accessToken: token })); setPrivateUrl(applicationId, token);
    const refresh = async () => {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const result = await response.json() as StatusResponse;
      if (result.application.paymentOrder) { setPaymentStatus(result.application.paymentOrder.paymentStatus.toUpperCase()); setInvoiceUrl(result.application.paymentOrder.invoiceUrl || ''); }
      if (result.application.portalAccess) setPaymentStatus('FINISHED');
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [applicationId, accessToken]);

  const next = () => {
    setError('');
    if (step === 'name') { if (!name.trim()) return setError('Please enter your full name.'); appendMessage('applicant', name); appendMessage('concierge', `Thank you, ${name}. What email address should we use for official correspondence?`); setStep('email'); }
    else if (step === 'email') { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Please enter a valid email address.'); appendMessage('applicant', email); appendMessage('concierge', 'What is the best phone/WhatsApp number for your private sales correspondence?'); setStep('phone'); }
    else if (step === 'phone') { if (!phone.trim()) return setError('Please enter your phone or WhatsApp number.'); appendMessage('applicant', phone); setStep('intent'); }
  };
  const back = () => { const previous: Partial<Record<Step, Step>> = { name: 'welcome', email: 'name', phone: 'email', intent: 'phone', payment: 'intent', verification: 'payment', summary: 'verification' }; setStep(previous[step] || 'welcome'); setError(''); };
  const field = (label: string, value: string, onChange: (value: string) => void, type: string, placeholder: string) => <div className="space-y-3"><label className="text-xs uppercase tracking-[0.2em] text-[#C5A059]">{label}</label><input autoFocus type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full border-b border-white/20 bg-transparent py-3 text-lg text-white outline-none focus:border-[#C5A059]" onKeyDown={(event) => { if (event.key === 'Enter') next(); }} /></div>;

  return <section id="apply" className="bg-[#141414] px-4 py-16 sm:px-8"><div className="mx-auto max-w-3xl"><div className="mb-8 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-gray-500"><span>Private application portal</span><span className="flex items-center gap-2 text-emerald-300"><LockKeyhole className="h-3.5 w-3.5" /> Confidential</span></div><div className="border border-[#C5A059]/25 bg-[#1b1b1b] p-6 shadow-2xl sm:p-10">
    {step !== 'submitted' && <div className="mb-10 h-1 bg-white/10"><div className="h-full bg-[#C5A059] transition-all" style={{ width: `${(['welcome', 'name', 'email', 'phone', 'intent', 'payment', 'verification', 'summary'].indexOf(step) + 1) / 8 * 100}%` }} /></div>}
    <div className="mb-8 flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#C5A059]/50 bg-[#242016] text-2xl">👑</div><div><div className="text-xs uppercase tracking-[0.2em] text-[#C5A059]">Crown Sales Concierge</div><h2 className="mt-2 font-serif-luxury text-3xl text-white">{step === 'submitted' ? 'Application Received' : 'Welcome to Crown Penthouse Collection'}</h2></div></div>
    {step === 'welcome' && <div className="space-y-6 text-sm leading-7 text-gray-300"><p>Welcome to the private application portal for the Crown Penthouse Collection.</p><p>Our residences are offered through a selective application process, with personalized assistance from inquiry through acquisition.</p><p>Please choose how you would like to proceed:</p><Choice options={['Begin My Application', 'Discuss Payment Options', 'Speak With a Sales Concierge']} onSelect={(choice) => { appendMessage('concierge', choice); if (choice === 'Discuss Payment Options') setIntent('Requesting More Information'); setStep('name'); }} /></div>}
    {step === 'name' && field('Full name', name, setName, 'text', 'Enter your full name as it should appear on your application')}
    {step === 'email' && field('Email address', email, setEmail, 'email', 'Enter email for official correspondence')}
    {step === 'phone' && field('Phone / WhatsApp', phone, setPhone, 'tel', 'Enter your private sales number')}
    {step === 'intent' && <Choice title="How would you describe your current interest?" options={intents} onSelect={(value) => { setIntent(value); appendMessage('applicant', value); setStep('payment'); }} />}
    {step === 'payment' && <div className="space-y-5"><h3 className="font-serif-luxury text-3xl text-white">Choose payment currency</h3><p className="text-sm text-gray-400">Application fee: <strong className="text-white">${data.applicationFee} USD</strong>. Secure checkout is provided by NOWPayments.</p><div className="grid gap-3">{coins.map((option) => <button key={option.code} onClick={() => { setCoin(option); appendMessage('applicant', `Selected ${option.label}`); setStep('verification'); }} className="flex items-center justify-between border border-white/15 p-4 text-left text-sm text-white hover:border-[#C5A059]">{option.label}<ChevronRight className="h-4 w-4 text-[#C5A059]" /></button>)}</div></div>}
    {step === 'verification' && <div className="space-y-6"><ShieldCheck className="h-10 w-10 text-[#C5A059]" /><h3 className="font-serif-luxury text-3xl text-white">Secure Payment & Applicant Verification</h3><p className="text-sm leading-7 text-gray-300">Pay the ${data.applicationFee} USD application fee through NOWPayments. The provider confirms the transaction automatically. Do not send funds to a manually supplied wallet address.</p><label className="flex items-start gap-3 text-sm text-gray-300"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 accent-[#C5A059]" /><span>I understand payment is confirmed by the payment provider and some applications may require identity verification.</span></label><button disabled={!acknowledged} onClick={() => setStep('summary')} className="gold-gradient w-full p-4 font-semibold text-[#121212] disabled:opacity-40">Review Application</button></div>}
    {step === 'summary' && <div className="space-y-6"><h3 className="font-serif-luxury text-3xl text-white">Application Summary</h3><div className="grid gap-4 border-y border-white/10 py-5 text-sm sm:grid-cols-2">{[['Applicant', name], ['Email', email], ['Phone', phone], ['Residence', data.title], ['Purchase interest', intent], ['Payment currency', coin.label], ['Application fee', `$${data.applicationFee} USD`]].map(([label, value]) => <div key={label}><div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div><div className="mt-1 text-gray-200">{value}</div></div>)}</div><div className="flex gap-3"><button onClick={() => setStep('name')} className="w-1/2 border border-white/15 p-4 text-sm text-white">Edit Information</button><button disabled={busy} onClick={submitApplication} className="gold-gradient w-1/2 p-4 text-sm font-semibold text-[#121212]">{busy ? 'Submitting...' : 'Submit Application'}</button></div></div>}
    {step === 'submitted' && <div className="space-y-6 text-sm leading-7 text-gray-300"><div className="flex items-center gap-3 text-emerald-300"><Check className="h-6 w-6" /> Application ID: {applicationId}</div><p>Thank you, {applicantName}. Your application is saved securely. Keep the private portal link in the address bar to return from another device.</p><div className="border border-white/10 bg-[#121212] p-5"><div className="text-xs uppercase tracking-widest text-gray-500">Payment status</div><p className="mt-2 font-semibold text-white">{paymentStatus === 'FINISHED' ? 'Payment verified' : paymentStatus === 'NOT STARTED' ? `Application fee: $${data.applicationFee} USD` : paymentStatus}</p>{paymentStatus === 'FINISHED' ? <p className="mt-2 text-emerald-300">Your tenant portal is active. Continue to upload your verification documents.</p> : <button disabled={busy} onClick={beginCheckout} className="gold-gradient mt-4 inline-flex w-full items-center justify-center gap-2 p-4 font-semibold text-[#121212]">{busy ? 'Preparing secure checkout...' : `Pay $${data.applicationFee} USD with ${coin.label}`}<ExternalLink className="h-4 w-4" /></button>}</div>{invoiceUrl && paymentStatus !== 'FINISHED' && <a href={invoiceUrl} className="text-[#C5A059] underline">Return to payment checkout</a>}<p className="border border-amber-300/20 bg-amber-300/5 p-4 text-amber-100">Provider confirmation is automatic. The tenant portal unlocks after NOWPayments confirms payment.</p></div>}
    {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
    {!['welcome', 'intent', 'payment', 'verification', 'summary', 'submitted'].includes(step) && <div className="mt-8 flex justify-between"><button onClick={back} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white"><ChevronLeft className="h-4 w-4" /> Back</button><button onClick={next} className="gold-gradient inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#121212]">Continue <ChevronRight className="h-4 w-4" /></button></div>}
  </div></div></section>;
};

const Choice: React.FC<{ title?: string; options: string[]; onSelect: (value: string) => void }> = ({ title, options, onSelect }) => <div className="space-y-5">{title && <h3 className="font-serif-luxury text-3xl text-white">{title}</h3>}<div className="grid gap-3">{options.map((option) => <button key={option} onClick={() => onSelect(option)} className="flex items-center justify-between border border-white/15 p-4 text-left text-sm text-white transition-colors hover:border-[#C5A059]">{option}<ChevronRight className="h-4 w-4 text-[#C5A059]" /></button>)}</div></div>;

export default ApplicationFlow;
