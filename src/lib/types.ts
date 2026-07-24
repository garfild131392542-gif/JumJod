export type ItemStatus = 'Pending' | 'Purchasing' | 'Issuing Item';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  line_user_id: string | null;
  link_code: string | null;
  link_code_expires_at: string | null;
  created_at: string;
  updated_at: string;
  line_group_id: string | null;
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: ItemStatus;
  image_url: string | null;
  reminder_date: string | null; // ISO string
  reminder_sent: boolean;
  po_date: string | null; // YYYY-MM-DD
  credit_term: 30 | 60 | 90 | null;
  budget_due_date: string | null; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
  is_pr: boolean;
  has_item_number: boolean;
  item_number: string | null;
  item_request_status: 'None' | 'Pending' | 'Added';
  pr_number: string | null;
  pr_status: 'Pending' | 'Ready' | 'Issued';
  line_group_id: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          line_user_id?: string | null;
          link_code?: string | null;
          link_code_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          line_group_id?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          line_user_id?: string | null;
          link_code?: string | null;
          link_code_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          line_group_id?: string | null;
        };
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: ItemStatus;
          image_url?: string | null;
          reminder_date?: string | null;
          reminder_sent?: boolean;
          po_date?: string | null;
          credit_term?: 30 | 60 | 90 | null;
          budget_due_date?: string | null;
          created_at?: string;
          updated_at?: string;
          is_pr?: boolean;
          has_item_number?: boolean;
          item_number?: string | null;
          item_request_status?: 'None' | 'Pending' | 'Added';
          pr_number?: string | null;
          pr_status?: 'Pending' | 'Ready' | 'Issued';
          line_group_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: ItemStatus;
          image_url?: string | null;
          reminder_date?: string | null;
          reminder_sent?: boolean;
          po_date?: string | null;
          credit_term?: 30 | 60 | 90 | null;
          budget_due_date?: string | null;
          created_at?: string;
          updated_at?: string;
          is_pr?: boolean;
          has_item_number?: boolean;
          item_number?: string | null;
          item_request_status?: 'None' | 'Pending' | 'Added';
          pr_number?: string | null;
          pr_status?: 'Pending' | 'Ready' | 'Issued';
          line_group_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export interface StockItem {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  category: string;
  min_threshold: number;
  priority: 'High' | 'Medium' | 'Low';
  created_at: string;
  updated_at: string;
}

export type PrStatus = 'Pending' | 'PR Issued' | 'PO Issued' | 'Completed';

export interface PrRequest {
  id: string;
  user_id: string;
  title: string;
  pr_no: string | null;
  po_no: string | null;
  qt_no: string | null;
  status: PrStatus;
  created_at: string;
  updated_at: string;
  notes?: string | null;
}

export type CalStatus = 'Normal' | 'Due Soon' | 'Overdue';

export interface LabCalibration {
  id: string;
  user_id: string;
  name: string;              // 1. ชื่อเครื่องมือ
  last_cal_date: string | null; // 2. ครั้งก่อนที่ส่ง Cal (YYYY-MM-DD)
  next_cal_date: string;     // 3. ครั้งถัดไปที่จะทำการ Cal (YYYY-MM-DD)
  notes?: string | null;
  created_at: string;
  updated_at: string;
}



