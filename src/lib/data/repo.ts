import type { Camp, CampInput, Profile, ProfileInput, Rows, TableName, Task, TaskInput } from "../types";

export interface Repo {
  mode: "demo" | "supabase";
  currentUser(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, fullName: string): Promise<{ needsConfirm: boolean }>;
  signOut(): Promise<void>;

  /** Ажилчид */
  listProfiles(): Promise<Profile[]>;
  createProfile(input: ProfileInput): Promise<Profile>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;

  listTasks(): Promise<Task[]>;
  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  listCamps(): Promise<Camp[]>;
  createCamp(input: CampInput): Promise<Camp>;
  updateCamp(id: string, patch: Partial<Camp>): Promise<Camp>;
  deleteCamp(id: string): Promise<void>;
  importCamps(inputs: CampInput[]): Promise<Camp[]>;

  /** Хэлтэс, хүсэлт, өдрийн тайлан, агентын түүх — ерөнхий CRUD */
  list<K extends TableName>(table: K): Promise<Rows[K][]>;
  insert<K extends TableName>(table: K, input: Partial<Rows[K]>): Promise<Rows[K]>;
  patch<K extends TableName>(table: K, id: string, patch: Partial<Rows[K]>): Promise<Rows[K]>;
  remove(table: TableName, id: string): Promise<void>;

  /** Бусдын өөрчлөлтийг сонсох. Буцаах функц нь unsubscribe. */
  subscribe(onChange: () => void): () => void;
}
