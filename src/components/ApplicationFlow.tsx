
import React, { useEffect, useMemo, useState } from 'react';
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

const API_URL = import.meta.env.VITE_API_URL || '';

interface ApplicationFlowProps {
  data: ApartmentData;
  onComplete: (record: ApplicantRecord) => void;
}

type Step =
  | 'welcome'
  | 'name'
  | 'email'
  | 'phone'
  | 'summary'
  | 'submitted';

const requestedApplication =
  typeof window === 'undefined'
    ? null
    : {
        id: new URLSearchParams(window.location.search).get(
          'application'
        ),
        access: new URLSearchParams(window.location.search).get(
          'access'
        )
      };

type StatusResponse = {
  application: ApplicantRecord & {
    portalAccess: boolean;
    paymentOrder: {
      paymentStatus: string;
      invoiceUrl: string | null;
    } | null;
  };
};

export const ApplicationFlow: React.FC<ApplicationFlowProps> = ({
  data,
  onComplete
}) => {
  const [step, setStep] = useState<Step>(
    requestedApplication?.id && requestedApplication.access
      ? 'submitted'
      : 'welcome'
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [applicationId, setApplicationId] = useState(
    requestedApplication?.id || ''
  );

  const [accessToken, setAccessToken] = useState(
    requestedApplication?.access || ''
  );

  const [paymentStatus, setPaymentStatus] = useState(
    'NOT STARTED'
  );

  const [invoiceUrl, setInvoiceUrl] = useState('');

  const [error, setError] = useState('');

  const [busy, setBusy] = useState(false);

  const [history, setHistory] = useState<ConversationEntry[]>([]);

  const applicantName = name.trim() || 'Applicant';

  /*
   * Build the application record that will be sent
   * to the backend.
   *
   * Payment preference is intentionally left empty because
   * NOWPayments will present the available payment options.
   */
  const record = useMemo<ApplicantRecord>(
    () => ({
      applicationId,
      name,
      email,
      phone,
      residence: data.title,
      budgetRange: data.price,
      purchaseIntent: 'Ready to Proceed',
      paymentPreference: 'NOWPayments',
      applicationStatus: 'NEW',
      paymentStatus: 'NOT REQUESTED',
      salesRepresentative: 'Crown Sales Concierge',
      createdAt: new Date().toISOString(),
      conversationHistory: history
    }),
    [
      applicationId,
      name,
      email,
      phone,
      data.title,
      data.price,
      history
    ]
  );

  /*
   * Keep the conversation history for the admin dashboard.
   */
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

  /*
   * Update the browser URL without reloading the page.
   *
   * This is important because we do NOT want the application
   * page to scroll back to the top after submitting.
   */
  const setPrivateUrl = (
    id: string,
    token: string
  ) => {
    const url =
      `${window.location.origin}/tenant-portal.html` +
      `?application=${encodeURIComponent(id)}` +
      `&access=${encodeURIComponent(token)}`;

    window.history.replaceState(
      null,
      '',
      url
    );
  };

  /*
   * Submit the application to the backend.
   *
   * The application is submitted FIRST.
   * Payment happens AFTER the application has been received.
   */
  const submitApplication = async () => {
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/api/applications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(record)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            'Application could not be submitted.'
        );
      }

      setApplicationId(result.applicationId);
      setAccessToken(result.accessToken);

      setPrivateUrl(
        result.applicationId,
        result.accessToken
      );

      sessionStorage.setItem(
        'crown_application_access',
        JSON.stringify({
          applicationId: result.applicationId,
          accessToken: result.accessToken
        })
      );

      /*
       * Notify the parent component that the application
       * has been successfully created.
       */
      onComplete({
        ...record,
        applicationId: result.applicationId,
        applicationStatus: 'UNDER REVIEW'
      });

      /*
       * Stay on the same page.
       * Do NOT use window.location.href or reload the page.
       */
      setStep('submitted');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Application could not be submitted.'
      );
    } finally {
      setBusy(false);
    }
  };

  /*
   * Start NOWPayments checkout.
   *
   * There is intentionally NO payCurrency field here.
   * NOWPayments will determine the available payment options.
   */
  const beginCheckout = async () => {
    if (!applicationId || !accessToken) {
      setError(
        'Your application session could not be found. Please return to your application.'
      );

      return;
    }

    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/api/applications/${encodeURIComponent(
          applicationId
        )}/payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.invoiceUrl) {
        throw new Error(
          result.message ||
            'Secure checkout could not be started.'
        );
      }

      setInvoiceUrl(result.invoiceUrl);

      /*
       * Open NOWPayments in the same tab.
       *
       * The application itself remains saved on the server.
       */
      window.location.assign(result.invoiceUrl);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'Secure checkout could not be started.'
      );
    } finally {
      setBusy(false);
    }
  };

  /*
   * Check payment/application status.
   *
   * Once NOWPayments confirms payment, the backend should
   * return portalAccess = true.
   */
  useEffect(() => {
    if (!applicationId) {
      return undefined;
    }

    const saved = sessionStorage.getItem(
      'crown_application_access'
    );

    let savedToken = '';

    if (saved) {
      try {
        savedToken =
          (
            JSON.parse(saved) as {
              accessToken?: string;
            }
          ).accessToken || '';
      } catch {
        savedToken = '';
      }
    }

    const token =
      accessToken ||
      requestedApplication?.access ||
      savedToken;

    if (!token) {
      return undefined;
    }

    setAccessToken(token);

    sessionStorage.setItem(
      'crown_application_access',
      JSON.stringify({
        applicationId,
        accessToken: token
      })
    );

    /*
     * Keep the private application URL in the address bar.
     */
    if (
      window.location.pathname !==
      '/tenant-portal.html'
    ) {
      setPrivateUrl(
        applicationId,
        token
      );
    }

    const refresh = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/applications/${encodeURIComponent(
            applicationId
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          return;
        }

        const result =
          (await response.json()) as StatusResponse;

        if (result.application.paymentOrder) {
          setPaymentStatus(
            result.application.paymentOrder.paymentStatus.toUpperCase()
          );

          setInvoiceUrl(
            result.application.paymentOrder.invoiceUrl || ''
          );
        }

        /*
         * The backend grants portalAccess only after
         * NOWPayments confirms the payment.
         */
        if (result.application.portalAccess) {
          setPaymentStatus('FINISHED');
        }
      } catch {
        /*
         * Keep existing UI state if the status check
         * temporarily fails.
         */
      }
    };

    void refresh();

    const timer = window.setInterval(
      () => void refresh(),
      10000
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [applicationId, accessToken]);

  /*
   * Move forward through the personal-information steps.
   */
  const next = () => {
    setError('');

    if (step === 'name') {
      if (!name.trim()) {
        setError(
          'Please enter your full name.'
        );

        return;
      }

      appendMessage(
        'applicant',
        name.trim()
      );

      setStep('email');

      return;
    }

    if (step === 'email') {
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email.trim()
        )
      ) {
        setError(
          'Please enter a valid email address.'
        );

        return;
      }

      appendMessage(
        'applicant',
        email.trim()
      );

      setStep('phone');

      return;
    }

    if (step === 'phone') {
      if (!phone.trim()) {
        setError(
          'Please enter your WhatsApp number.'
        );

        return;
      }

      appendMessage(
        'applicant',
        phone.trim()
      );

      setStep('summary');
    }
  };

  /*
   * Go back one step.
   */
  const back = () => {
    const previous: Partial<
      Record<Step, Step>
    > = {
      name: 'welcome',
      email: 'name',
      phone: 'email',
      summary: 'phone'
    };

    setStep(
      previous[step] || 'welcome'
    );

    setError('');
  };

  /*
   * Reusable input field.
   */
  const field = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    type: string,
    placeholder: string
  ) => (
    <div className="space-y-3">
      <label className="text-xs uppercase tracking-[0.2em] text-[#C5A059]">
        {label}
      </label>

      <input
        autoFocus
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full border-b border-white/20 bg-transparent py-3 text-lg text-white outline-none focus:border-[#C5A059]"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            next();
          }
        }}
      />
    </div>
  );

  /*
   * Number of visual application stages.
   *
   * Welcome
   * Name
   * Email
   * WhatsApp
   * Review
   * Summary
   */
  const progressSteps = [
    'welcome',
    'name',
    'email',
    'phone',
    'summary'
  ];

  const progressIndex =
    progressSteps.indexOf(step);

  const progressWidth =
    step === 'submitted'
      ? 100
      : ((progressIndex + 1) /
          progressSteps.length) *
        100;

  return (
    <section
      id="apply"
      className="bg-[#141414] px-4 py-16 sm:px-8"
    >
      <div className="mx-auto max-w-3xl">

        <div className="mb-8 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-gray-500">
          <span>
            Private application portal
          </span>

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
                style={{
                  width: `${progressWidth}%`
                }}
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
                  ? 'Application Received'
                  : 'Welcome to Crown Penthouse Collection'}
              </h2>
            </div>
          </div>

          {/* =========================
              WELCOME
          ========================== */}
          {step === 'welcome' && (
            <div className="space-y-6 text-sm leading-7 text-gray-300">

              <p>
                Welcome to the private application portal for the Crown Penthouse Collection.
              </p>

              <p>
                Our residences are offered through a selective application process. Please complete the short application below to begin.
              </p>

              <div className="border border-[#C5A059]/20 bg-[#121212] p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                  Application fee
                </div>

                <div className="mt-2 text-2xl font-semibold text-white">
                  ${data.applicationFee} USD
                </div>

                <p className="mt-2 text-sm text-gray-400">
                  Secure payment is processed through NOWPayments after your application has been submitted.
                </p>
              </div>

              <button
                onClick={() => {
                  appendMessage(
                    'applicant',
                    'Begin My Application'
                  );

                  setStep('name');
                }}
                className="gold-gradient flex w-full items-center justify-center gap-2 p-4 font-semibold text-[#121212]"
              >
                Begin My Application
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* =========================
              NAME
          ========================== */}
          {step === 'name' && (
            <div className="space-y-6">
              {field(
                'Full name',
                name,
                setName,
                'text',
                'Enter your full name as it should appear on your application'
              )}

              <p className="text-sm text-gray-500">
                Please provide your legal/full name for the application record.
              </p>
            </div>
          )}

          {/* =========================
              EMAIL
          ========================== */}
          {step === 'email' && (
            <div className="space-y-6">
              {field(
                'Email address',
                email,
                setEmail,
                'email',
                'Enter your email address'
              )}

              <p className="text-sm text-gray-500">
                We will use this email for application and payment correspondence.
              </p>
            </div>
          )}

          {/* =========================
              WHATSAPP
          ========================== */}
          {step === 'phone' && (
            <div className="space-y-6">
              {field(
                'WhatsApp number',
                phone,
                setPhone,
                'tel',
                'Enter your WhatsApp number'
              )}

              <p className="text-sm text-gray-500">
                Include your country code where possible, for example +234...
              </p>
            </div>
          )}

          {/* =========================
              APPLICATION SUMMARY
          ========================== */}
          {step === 'summary' && (
            <div className="space-y-6">

              <div>
                <h3 className="font-serif-luxury text-3xl text-white">
                  Review Application
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Please review your information before submitting your application.
                </p>
              </div>

              <div className="border-y border-white/10 py-5">

                <div className="grid gap-5 sm:grid-cols-2">

                  <SummaryItem
                    label="Full name"
                    value={name}
                  />

                  <SummaryItem
                    label="Email"
                    value={email}
                  />

                  <SummaryItem
                    label="WhatsApp"
                    value={phone}
                  />

                  <SummaryItem
                    label="Residence"
                    value={data.title}
                  />

                  <SummaryItem
                    label="Application fee"
                    value={`$${data.applicationFee} USD`}
                  />

                  <SummaryItem
                    label="Payment provider"
                    value="NOWPayments"
                  />

                </div>
              </div>

              <div className="border border-[#C5A059]/20 bg-[#121212] p-5">
                <div className="text-xs uppercase tracking-widest text-[#C5A059]">
                  What happens next?
                </div>

                <div className="mt-4 space-y-3 text-sm text-gray-300">

                  <p>
                    1. Submit your application.
                  </p>

                  <p>
                    2. Your application will be securely sent to our administration team.
                  </p>

                  <p>
                    3. You will receive a secure NOWPayments checkout option.
                  </p>

                  <p>
                    4. Complete the ${data.applicationFee} USD application fee.
                  </p>

                  <p>
                    5. Once payment is confirmed, your private tenant portal will be unlocked for document submission.
                  </p>

                </div>
              </div>

              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={() => setStep('name')}
                  disabled={busy}
                  className="flex w-1/2 items-center justify-center gap-2 border border-white/15 p-4 text-sm text-white hover:border-white/30 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Edit Information
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={submitApplication}
                  className="gold-gradient flex w-1/2 items-center justify-center gap-2 p-4 text-sm font-semibold text-[#121212] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy
                    ? 'Submitting...'
                    : 'Submit Application'}

                  {!busy && (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

              </div>
            </div>
          )}

          {/* =========================
              APPLICATION RECEIVED
          ========================== */}
          {step === 'submitted' && (
            <div className="space-y-6 text-sm leading-7 text-gray-300">

              <div className="flex items-center gap-3 text-emerald-300">
                <Check className="h-6 w-6" />

                <span>
                  Application ID: {applicationId}
                </span>
              </div>

              <div>
                <h3 className="font-serif-luxury text-2xl text-white">
                  Thank you, {applicantName}.
                </h3>

                <p className="mt-3">
                  Your application has been securely submitted to the Crown Penthouse Collection administration team.
                </p>
              </div>

              {/* =========================
                  PAYMENT
              ========================== */}
              <div className="border border-white/10 bg-[#121212] p-5">

                <div className="text-xs uppercase tracking-widest text-gray-500">
                  Application fee
                </div>

                <p className="mt-2 text-2xl font-semibold text-white">
                  ${data.applicationFee} USD
                </p>

                {paymentStatus === 'FINISHED' ? (
                  <div className="mt-5 space-y-3">

                    <div className="flex items-center gap-2 text-emerald-300">
                      <Check className="h-5 w-5" />

                      <span className="font-semibold">
                        Payment verified
                      </span>
                    </div>

                    <p className="text-gray-300">
                      Your payment has been confirmed. Your tenant portal is now active.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        window.location.href =
                          `/tenant-portal.html?application=${encodeURIComponent(
                            applicationId
                          )}&access=${encodeURIComponent(
                            accessToken
                          )}`;
                      }}
                      className="gold-gradient flex w-full items-center justify-center gap-2 p-4 font-semibold text-[#121212]"
                    >
                      Continue to Tenant Portal
                      <ExternalLink className="h-4 w-4" />
                    </button>

                  </div>
                ) : (
                  <div className="mt-4 space-y-4">

                    <p className="text-sm text-gray-400">
                      Complete the ${data.applicationFee} USD application fee through our secure NOWPayments checkout.
                    </p>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={beginCheckout}
                      className="gold-gradient flex w-full items-center justify-center gap-2 p-4 font-semibold text-[#121212] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy
                        ? 'Preparing Secure Payment...'
                        : `Pay $${data.applicationFee} USD`}
                      {!busy && (
                        <ExternalLink className="h-4 w-4" />
                      )}
                    </button>

                    {invoiceUrl && (
                      <a
                        href={invoiceUrl}
                        className="block text-center text-[#C5A059] underline"
                      >
                        Return to payment checkout
                      </a>
                    )}

                  </div>
                )}
              </div>

              {/* =========================
                  PORTAL MESSAGE
              ========================== */}
              <div className="border border-amber-300/20 bg-amber-300/5 p-4 text-amber-100">

                {paymentStatus === 'FINISHED' ? (
                  <p>
                    Payment has been confirmed and your tenant portal has been unlocked. You can now upload the requested information and verification documents.
                  </p>
                ) : (
                  <p>
                    Your tenant portal will automatically unlock after NOWPayments confirms your payment.
                  </p>
                )}

              </div>

              <p className="text-xs leading-6 text-gray-500">
                Your private application session is protected by your application ID and access token. Keep your private application link secure.
              </p>

            </div>
          )}

          {/* =========================
              ERROR
          ========================== */}
          {error && (
            <div className="mt-5 border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* =========================
              BACK / CONTINUE
          ========================== */}
          {[
            'name',
            'email',
            'phone'
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
                {step === 'phone'
                  ? 'Review Application'
                  : 'Continue'}

                <ChevronRight className="h-4 w-4" />
              </button>

            </div>
          )}

        </div>
      </div>
    </section>
  );
};

/*
 * Summary item component.
 */
const SummaryItem: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest text-gray-500">
      {label}
    </div>

    <div className="mt-1 break-words text-gray-200">
      {value || '—'}
    </div>
  </div>
);

export default ApplicationFlow;
