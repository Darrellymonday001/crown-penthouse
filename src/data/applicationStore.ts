export type ApplicationStatus = 'NEW' | 'UNDER REVIEW' | 'CONTACTED' | 'RESIDENCE RESERVED' | 'PAYMENT PENDING' | 'PAYMENT VERIFIED' | 'ACQUISITION IN PROGRESS' | 'COMPLETED';

export interface ConversationEntry { sender: 'concierge' | 'applicant' | 'system'; message: string; createdAt: string; }

export interface ApplicantRecord {
  applicationId: string;
  name: string;
  email: string;
  phone: string;
  residence: string;
  budgetRange: string;
  purchaseIntent: string;
  paymentPreference: string;
  applicationStatus: ApplicationStatus;
  paymentStatus: string;
  salesRepresentative: string;
  createdAt: string;
  conversationHistory: ConversationEntry[];
}
