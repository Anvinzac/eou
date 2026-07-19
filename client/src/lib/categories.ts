import { 
  Gamepad2, UtensilsCrossed, Film, Plane, Users, Clock, 
  Wallet, Heart, Home, TrendingUp, Compass 
} from "lucide-react";

export const CATEGORIES = [
  { key: 'Leisure', icon: Gamepad2, colorClass: 'cat-leisure', bgClass: 'cat-bg-leisure' },
  { key: 'Food', icon: UtensilsCrossed, colorClass: 'cat-food', bgClass: 'cat-bg-food' },
  { key: 'Entertainment', icon: Film, colorClass: 'cat-entertainment', bgClass: 'cat-bg-entertainment' },
  { key: 'Travel', icon: Plane, colorClass: 'cat-travel', bgClass: 'cat-bg-travel' },
  { key: 'Social', icon: Users, colorClass: 'cat-social', bgClass: 'cat-bg-social' },
  { key: 'Habits', icon: Clock, colorClass: 'cat-habits', bgClass: 'cat-bg-habits' },
  { key: 'Spending', icon: Wallet, colorClass: 'cat-spending', bgClass: 'cat-bg-spending' },
  { key: 'Emotion', icon: Heart, colorClass: 'cat-emotion', bgClass: 'cat-bg-emotion' },
  { key: 'Home', icon: Home, colorClass: 'cat-home', bgClass: 'cat-bg-home' },
  { key: 'Growth', icon: TrendingUp, colorClass: 'cat-growth', bgClass: 'cat-bg-growth' },
  { key: 'Values', icon: Compass, colorClass: 'cat-values', bgClass: 'cat-bg-values' },
] as const;

export type CategoryKey = typeof CATEGORIES[number]['key'];

export function getCategoryMeta(key: string) {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES[0];
}
