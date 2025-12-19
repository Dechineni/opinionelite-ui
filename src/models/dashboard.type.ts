// FILE: src/models/dashboard.type.ts
import { LucideIcon } from "lucide-react";

export interface StatCard {
  title: string;
  value: number;
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
}


export interface StatCard {
  title: string;
  value: number;
}

export interface MonthlyData {
  month: string;
  click: number;
  complete?: number;
  failure?: number;
}

export interface Survey {
  projectCode: string;
  name: string;
  count: number;
}