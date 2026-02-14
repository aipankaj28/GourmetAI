export enum Category {
  STARTER = 'Starter',
  MAIN = 'Main Course',
  DESSERT = 'Dessert',
  DRINK = 'Drink',
  SIDE = 'Side Dish',
  SOUPS = 'Soups',
}

export enum MealType {
  VEG = 'Veg',
  NON_VEG = 'Non-Veg',
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: Category;
  type: MealType;
  price: number;
  availability: boolean;
  imageUrl: string;
}

export enum OrderStatus {
  IN_PROGRESS = 'In Progress',
  PAID = 'Paid',
}

export enum ItemStatus {
  PENDING = 'Pending',
  PREPARING = 'Preparing',
  SERVED = 'Served',
  CANCELLED = 'Cancelled',
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: ItemStatus; // Updated to use ItemStatus
}

export interface Order {
  order_id: string;
  table_number_or_online: string;
  items_ordered: CartItem[];
  status: OrderStatus;
  total_amount: number;
  timestamp: string;
}

export interface TaxRate {
  name: string;
  percentage: number; // e.g., 0.05 for 5%
}

export enum Intent {
  ORDER = 'orderFood',
  REMOVE = 'removeFood',
  QUERY = 'queryMenu',
  SERVICE = 'requestService',
  BILL = 'requestBill',
  NONE = 'none',
}

export interface IntentResult {
  intent: Intent;
  args?: Record<string, unknown>;
}

export enum AgentMessageSender {
  USER = 'user',
  AVATAR = 'avatar',
  SYSTEM = 'system',
}

export interface ChatHistoryItem {
  sender: AgentMessageSender;
  text: string;
  timestamp: string;
}

export interface LiveAgentState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isAwake: boolean;
  currentInputTranscription: string;
  currentOutputTranscription: string;
  error: string | null;
}

export type AlertType = 'water' | 'server' | 'napkins' | 'custom' | 'send someone' | 'room service' | 'cutlery' | null;
export interface ServiceAlert {
  id: string;
  table: string;
  type: AlertType;
  message?: string;
  timestamp: string;
  resolved: boolean;
}