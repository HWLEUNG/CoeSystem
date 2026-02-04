
export type AppView = 'form' | 'list';

export enum Status {
  Processing = 'processing',
  Completed = 'completed'
}

export interface ApplicationRecord {
  id: string;
  schoolName: string;
  applicantName: string;
  phone: string;
  confirmedDate: string;
  startTime: string;
  endTime: string;
  firstChoiceDate: string;
  firstChoiceStart: string;
  firstChoiceEnd: string;
  secondChoiceDate: string;
  secondChoiceStart: string;
  secondChoiceEnd: string;
  dateOther?: string;
  participantCount: string;
  difficulties: string;
  expectations: string;
  staff: string[];
  status: Status;
  createdAt?: string;
}

export interface StatusOption {
  value: Status;
  label: string;
  color: string;
}
