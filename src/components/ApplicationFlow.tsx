
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LockKeyhole
} from 'lucide-react';
import { ApartmentData } from '../data/apartmentData';
import {
  ApplicantRecord,
  ConversationEntry
} from '../data/applicationStore';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const getRequestedApplication = () => {
  if (typeof window === 'undefined') {
    return { id: null, access: null };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    id: params.get('application'),
    access: params.get('access')
  };
};

const requestedApplication = getRequestedApplication();

type Step =
  | 'welcome'
  | 'name'
  | 'email'
  | 'phone'
  | 'address'
  | 'moveIn'
  | 'employment'
  | 'summary'
  | 'submitted';

type EmploymentStatus =
  | 'Employed'
  | 'Self-employed'
  | 'Business owner'
  | 'Student'
  | 'Unemployed'
  | 'Retired'
  | 'Other';

type ApplicationDetails = {
  name: string;
  email: string;
  phone: string;
  currentAddress: string;
  desiredMoveInDate: string;
  employmentStatus: EmploymentStatus | '';
  residence: string;
  budgetRange: string | number;
  purchaseIntent: string;
  paymentPreference: string;
  applicationStatus: string;
  paymentStatus: string;
  salesRepresentative: string;
  createdAt: string;
  conversationHistory: ConversationEntry[];
};

type StatusResponse = {
  application: Partial<ApplicationDetails> & {
    applicationId?: string;
    portalAccess: boolean;
    paymentStatus?: string;
    paymentOrder?: {
      paymentStatus: string;
      invoiceUrl: string | null;
    } | null;
  };
};

interface ApplicationFlowProps {
  data: ApartmentData;
  onComplete: (record: ApplicantRecord) => void;
}

export const ApplicationFlow: React.FC<ApplicationFlowProps> = ({
  data,
  onComplete
}) => {
  const [step, setStep] = useState<Step>(
    requestedApplication.id && requestedApplication.access
      ? 'submitted'
      : 'welcome'
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [desiredMoveInDate, setDesiredMoveInDate] = useState('');
  const [employmentStatus, setEmploymentStatus] =
    useState<EmploymentStatus | ''>('');

  const [applicationId, setApplicationId] = useState(
    requestedApplication.id || ''
  );

  const [accessToken, setAccessToken] = useState(
    requestedApplication.access || ''
  );

  const [paymentStatus, setPaymentStatus] = useState('NOT STARTED');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ConversationEntry[]>([]);

  // Prevent duplicate completion notifications during status polling.
  const completedRef = useRef(false);

  const applicantName = name.trim() || 'Applicant';

  // Use local calendar dates to avoid UTC date-offset problems.
  const today = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }, []);

  const record = useMemo<ApplicationDetails>(
    () => ({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      currentAddress: currentAddress.trim(),
      desiredMoveInDate,
      employmentStatus,
      residence: data.title,
      budgetRange: data.price,
      purchaseIntent: 'Ready to Proceed',
      paymentPreference: 'NOWPayments',
      applicationStatus: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      salesRepresentative: 'Crown Sales Concierge',
      createdAt: new Date().toISOString(),
      conversationHistory: history
    }),
    [
      name,
      email,
      phone,
      currentAddress,
      desiredMoveInDate,
      employmentStatus,
      data.title,
      data.price,
      history
    ]
  );

  const appendMessage = (
    sender: ConversationEntry['sender'],
    message: string
  ) => {
    setHistory((items) => [
      ...items,
      {
        sender,
        message,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const setPrivateUrl = (id: string, token: string) => {
    const url =
      `${window.location.origin}/tenant-portal.html` +
      `?application=${encodeURIComponent(id)}` +
      `&access=${encodeURIComponent(token)}`;

    // Update the URL without a page reload or scroll-to-top.
    window.history.replaceState(null, '', url);
  };

  /*
   * Create a pending payment session.
   *
   * The backend must not expose this as a completed/paid
   * application. It should create a pending payment record,
   * create the NOWPayments invoice, and return the invoice URL.
   */
  const beginCheckout = async () => {
    if (busy) return;

    setError('');

    if (
      !name.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      !phone.trim() ||
      !currentAddress.trim() ||
      !desiredMoveInDate ||
      !employmentStatus
    ) {
      setError('Please complete all required application fields.');
      return;
    }

    if (desiredMoveInDate < today) {
      setError('The desired move-in date cannot be in the past.');
      setStep('moveIn');
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `${API_URL}/api/applications/payment-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...record,
            applicationFee: Number(data.applicationFee),
            currency: 'USD'
          })
        }
      );

      const result = await response.json().catch(() => ({}));

      if (
        !response.ok ||
        !result.applicationId ||
        !result.accessToken ||
        !result.invoiceUrl
      ) {
        throw new Error(
          result.message ||
            'Unable to prepare secure payment. Please try again.'
        );
      }

      setApplicationId(result.applicationId);
      setAccessToken(result.accessToken);
      setInvoiceUrl(result.invoiceUrl);
      setPaymentStatus('WAITING');
      
      sessionStorage.setItem(
        'crown_application_access',
        JSON.stringify({
          applicationId: result.applicationId,
          accessToken: result.accessToken
        })
      );

      setPrivateUrl(result.applicationId, result.accessToken);

      appendMessage(
        'applicant',
        'Reviewed application and proceeded to NOWPayments checkout.'
      );

      // The user goes to the secure payment page.
      // The server must independently verify the payment.
      window.location.assign(result.invoiceUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Unable to prepare secure payment.'
      );
    } finally {
      setBusy(false);
    }
  };

  /*
   * Poll the server after returning from NOWPayments.
   *
   * A browser redirect alone does not prove payment.
   * Only the backend's verified portalAccess value unlocks
   * the portal and triggers the completion notification.
   */
  useEffect(() => {
    if (!applicationId) return undefined;

    const saved = sessionStorage.getItem(
      'crown_application_access'
    );

    let savedToken = '';

    if (saved) {
      try {
        savedToken =
          (JSON.parse(saved) as { accessToken?: string }).accessToken ||
          '';
      } catch {
        savedToken = '';
      }
    }

    const token =
      accessToken ||
      requestedApplication.access ||
      savedToken;

    if (!token) return undefined;

    setAccessToken(token);

    sessionStorage.setItem(
      'crown_application_access',
      JSON.stringify({
        applicationId,
        accessToken: token
      })
    );

    const refresh = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/applications/${encodeURIComponent(applicationId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            cache: 'no-store'
          }
        );

        if (!response.ok) return;

        const result = (await response.json()) as StatusResponse;
        const application = result.application;

        const status = (
          application.paymentOrder?.paymentStatus ||
          application.paymentStatus ||
          'PENDING'
        ).toUpperCase();

        setPaymentStatus(status);

        if (application.paymentOrder?.invoiceUrl) {
          setInvoiceUrl(application.paymentOrder.invoiceUrl);
        }

        if (application.portalAccess === true) {
          setPaymentStatus('FINISHED');
          setStep('submitted');

          if (!completedRef.current) {
            completedRef.current = true;

            onComplete({
              ...record,
              ...(application as Partial<ApplicantRecord>),
              applicationId
            } as ApplicantRecord);
          }
        }
      } catch {
        // A temporary network error must not imply payment success.
      }
    };

    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [applicationId, accessToken, onComplete, record]);

  const next = () => {
    setError('');

    switch (step) {
      case 'name':
        if (!name.trim()) {
          setError('Please enter your full name.');
          return;
        }
        appendMessage('applicant', name.trim());
        setStep('email');
        break;

      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setError('Please enter a valid email address.');
          return;
        }
        appendMessage('applicant', email.trim());
        setStep('phone');
        break;

      case 'phone':
        if (!phone.trim()) {
          setError('Please enter your WhatsApp number.');
          return;
        }
        appendMessage('applicant', phone.trim());
        setStep('address');
        break;

      case 'address':
        if (!currentAddress.trim()) {
          setError('Please enter your current residential address.');
          return;
        }
        appendMessage('applicant', `Current address: ${currentAddress.trim()}`);
        setStep('moveIn');
        break;

      case 'moveIn':
        if (!desiredMoveInDate) {
          setError('Please select your desired move-in date.');
          return;
        }
        if (desiredMoveInDate < today) {
          setError('Please select today or a future date.');
          return;
        }
        appendMessage('applicant', `Desired move-in date: ${desiredMoveInDate}`);
        setStep('employment');
        break;

      case 'employment':
        if (!employmentStatus) {
          setError('Please select your employment status.');
          return;
        }
        appendMessage('applicant', `Employment status: ${employmentStatus}`);
        setStep('summary');
        break;
    }
  };

  const back = () => {
    const previous: Partial<Record<Step, Step>> = {
      name: 'welcome',
      email: 'name',
      phone: 'email',
      address: 'phone',
      moveIn: 'address',
      employment: 'moveIn',
      summary: 'employment'
    };

    setStep(previous[step] || 'welcome');
    setError('');
  };

  const field = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    type: string,
    placeholder: string
  ) => (
    <div className="space-y-3">
      <label className="block text-xs uppercase tracking-[0.2em] text-[#C5A059]">
        {label}
      </label>

      <input
        autoFocus
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border-b border-white/20 bg-transparent py-3 text-lg text-white outline-none focus:border-[#C5A059]"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            next();
          }
        }}
      />
    </div>
  );

  const progressSteps: Step[] = [
    'welcome',
    'name',
    'email',
    'phone',
    'address',
    'moveIn',
    'employment',
    'summary'
  ];

  const progressIndex = progressSteps.indexOf(step);
  const progressWidth =
    step === 'submitted'
      ? 100
      : ((Math.max(progressIndex, 0) + 1) / progressSteps.length) * 100;

  return (
    <section id="apply" className="bg-[#141414] px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-gray-500">
          <span>Private application portal</span>
          <span className="flex items-center gap-2 text-emerald-300">
            <LockKeyhole className="h-3.5 w-3.5" />
            Confidential
          </span>
        </div>

        <div className="border border-[#C5A059]/25 bg-[#1b1b1b] p-6 shadow-2xl sm:p-10">
          {step !== 'submitted' && (
            <div className="mb-10 h-1 bg-white/10">
              <div
                className="h-full bg-[#C5A059] transition-all duration-500"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          )}

          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#C5A059]/50 bg-[#242016] text-2xl">
              👑
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                Crown Sales Concierge
              </div>
              <h2 className="mt-2 font-serif-luxury text-3xl text-white">
                {step === 'submitted'
                  ? 'Application Status'
                  : 'Welcome to Crown Penthouse Collection'}
              </h2>
            </div>
          </div>

          {step === 'welcome' && (
            <div className="space-y-6 text-sm leading-7 text-gray-300">
              <p>
                Welcome to the private application portal for the Crown
                Penthouse Collection.
              </p>
              <p>
                Complete your personal and residence information, review
                your application, and proceed to secure payment.
              </p>

              <div className="border border-[#C5A059]/20 bg-[#121212] p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                  Application fee
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  ${data.applicationFee} USD
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Payment is processed securely through NOWPayments.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  appendMessage('applicant', 'Begin My Application');
                  setStep('name');
                }}
                className="gold-gradient flex w-full items-center justify-center gap-2 p-4 font-semibold text-[#121212]"
              >
                Begin My Application
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step === 'name' && (
            <div className="space-y-6">
              {field('Full name', name, setName, 'text', 'Enter your full legal name')}
            </div>
          )}

          {step === 'email' && (
            <div className="space-y-6">
              {field('Email address', email, setEmail, 'email', 'Enter your email address')}
            </div>
          )}

          {step === 'phone' && (
            <div className="space-y-6">
              {field('WhatsApp number', phone, setPhone, 'tel', 'Include your country code, e.g. +234...')}
            </div>
          )}

          {step === 'address' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                  Current residential address
                </label>
                <textarea
                  autoFocus
                  required
                  rows={3}
                  value={currentAddress}
                  onChange={(event) => setCurrentAddress(event.target.value)}
                  placeholder="Enter your current house number, street, city, state and country"
                  className="w-full resize-y border-b border-white/20 bg-transparent py-3 text-base text-white outline-none focus:border-[#C5A059]"
                />
              </div>
              <p className="text-sm text-gray-500">
                Provide the address where you currently reside.
              </p>
            </div>
          )}

          {step === 'moveIn' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                  Desired move-in date
                </label>
                <input
                  autoFocus
                  required
                  type="date"
                  min={today}
                  value={desiredMoveInDate}
                  onChange={(event) => setDesiredMoveInDate(event.target.value)}
                  className="w-full border-b border-white/20 bg-transparent py-3 text-lg text-white outline-none focus:border-[#C5A059] [color-scheme:dark]"
                />
              </div>
              <p className="text-sm text-gray-500">
                Click the date field to open the calendar and select your
                preferred move-in date.
              </p>
            </div>
          )}

          {step === 'employment' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                  Employment status
                </label>
                <select
                  required
                  value={employmentStatus}
                  onChange={(event) =>
                    setEmploymentStatus(event.target.value as EmploymentStatus | '')
                  }
                  className="w-full border-b border-white/20 bg-[#1b1b1b] py-3 text-lg text-white outline-none focus:border-[#C5A059]"
                >
                  <option value="">Select employment status</option>
                  <option value="Employed">Employed</option>
                  <option value="Self-employed">Self-employed</option>
                  <option value="Business owner">Business owner</option>
                  <option value="Student">Student</option>
                  <option value="Unemployed">Unemployed</option>
                  <option value="Retired">Retired</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <p className="text-sm text-gray-500">
                Select the option that best describes your current status.
              </p>
            </div>
          )}

          {step === 'summary' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-serif-luxury text-3xl text-white">
                  Application Summary
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Carefully review all information before proceeding to
                  payment. You can go back to edit any field.
                </p>
              </div>

              <div className="border-y border-white/10 py-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <SummaryItem label="Full name" value={name} />
                  <SummaryItem label="Email address" value={email} />
                  <SummaryItem label="WhatsApp number" value={phone} />
                  <SummaryItem label="Current address" value={currentAddress} />
                  <SummaryItem label="Desired move-in date" value={desiredMoveInDate} />
                  <SummaryItem label="Employment status" value={employmentStatus} />
                  <SummaryItem label="Residence" value={data.title} />
                  <SummaryItem label="Listed price" value={String(data.price)} />
                  <SummaryItem
                    label="Application fee"
                    value={`$${data.applicationFee} USD`}
                  />
                  <SummaryItem label="Payment provider" value="NOWPayments" />
                </div>
              </div>

              <div className="border border-[#C5A059]/20 bg-[#121212] p-5">
                <div className="text-xs uppercase tracking-widest text-[#C5A059]">
                  Before you continue
                </div>
                <div className="mt-4 space-y-3 text-sm text-gray-300">
                  <p>1. Review and confirm your application details.</p>
                  <p>2. Continue to NOWPayments to pay the application fee.</p>
                  <p>3. Our server verifies the payment with NOWPayments.</p>
                  <p>4. After verified payment, the application is finalized for administration.</p>
                  <p>5. Your tenant portal becomes available after payment verification.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={back}
                  disabled={busy}
                  className="flex w-1/2 items-center justify-center gap-2 border border-white/15 p-4 text-sm text-white disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Edit Information
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={beginCheckout}
                  className="gold-gradient flex w-1/2 items-center justify-center gap-2 p-4 text-sm font-semibold text-[#121212] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Preparing Payment...' : 'Proceed to Payment'}
                  {!busy && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {step === 'submitted' && (
            <div className="space-y-6 text-sm leading-7 text-gray-300">
              <div className="flex items-center gap-3 text-emerald-300">
                <Check className="h-6 w-6" />
                <span>Application reference: {applicationId}</span>
              </div>

              <h3 className="font-serif-luxury text-2xl text-white">
                Thank you, {applicantName}.
              </h3>

              {paymentStatus === 'FINISHED' ? (
                <div className="space-y-5">
                  <div className="border border-emerald-300/20 bg-emerald-300/5 p-5">
                    <p className="font-semibold text-emerald-300">
                      Payment verified by the server
                    </p>
                    <p className="mt-2">
                      Your payment has been confirmed and your tenant portal
                      access has been enabled.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.assign(
                        `/tenant-portal.html?application=${encodeURIComponent(applicationId)}&access=${encodeURIComponent(accessToken)}`
                      );
                    }}
                    className="gold-gradient flex w-full items-center justify-center gap-2 p-4 font-semibold text-[#121212]"
                  >
                    Continue to Tenant Portal
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="border border-[#C5A059]/20 bg-[#121212] p-5">
                  <p className="font-semibold text-white">
                    Payment confirmation pending
                  </p>
                  <p className="mt-2 text-gray-400">
                    We are waiting for NOWPayments to confirm your payment.
                    Your portal will not unlock until the server verifies it.
                  </p>

                  <p className="mt-4 text-sm">
                    Current status: <strong>{paymentStatus}</strong>
                  </p>

                  {invoiceUrl && (
                    <a
                      href={invoiceUrl}
                      className="mt-4 inline-block text-[#C5A059] underline"
                    >
                      Return to NOWPayments checkout
                    </a>
                  )}
                </div>
              )}

              <p className="text-xs leading-6 text-gray-500">
                Keep your private application link secure. Do not share your
                access token with anyone.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          {[
            'name',
            'email',
            'phone',
            'address',
            'moveIn',
            'employment'
          ].includes(step) && (
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={back}
                disabled={busy}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              <button
                type="button"
                onClick={next}
                disabled={busy}
                className="gold-gradient inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#121212] disabled:opacity-50"
              >
                {step === 'employment' ? 'Review Application' : 'Continue'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const SummaryItem: React.FC<{
  label: string;
  value: string | number | null | undefined;
}> = ({ label, value }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-widest text-gray-500">
      {label}
    </div>
    <div className="mt-1 break-words text-gray-200">
      {value === null || value === undefined || value === ''
        ? '—'
        : String(value)}
    </div>
  </div>
);

export default ApplicationFlow;
