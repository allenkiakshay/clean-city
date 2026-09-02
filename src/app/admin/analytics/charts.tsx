"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 11, fill: "currentColor", opacity: 0.6 };
const GRID = "currentColor";

const BUCKET_COLOUR: Record<string, string> = {
  LOW: "#2E7D57",
  MEDIUM: "#A87708",
  HIGH: "#BF5A1C",
  CRITICAL: "#A3302A",
};

export function TrendChart({
  data,
}: {
  data: { day: string; created: number; resolved: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} strokeOpacity={0.12} vertical={false} />
        <XAxis
          dataKey="day"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => value.slice(5)}
          minTickGap={24}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid rgba(128,128,128,0.3)",
          }}
        />
        <Line
          type="monotone"
          dataKey="created"
          stroke="#BF5A1C"
          strokeWidth={2}
          dot={false}
          name="Reported"
        />
        <Line
          type="monotone"
          dataKey="resolved"
          stroke="#2E7D57"
          strokeWidth={2}
          dot={false}
          name="Resolved"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} strokeOpacity={0.12} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid rgba(128,128,128,0.3)",
          }}
        />
        <Bar dataKey="count" fill="#0F6B4F" radius={[3, 3, 0, 0]} name="Reports" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BucketChart({
  data,
}: {
  data: { bucket: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} strokeOpacity={0.12} vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid rgba(128,128,128,0.3)",
          }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} name="Open reports">
          {data.map((row) => (
            <Cell key={row.bucket} fill={BUCKET_COLOUR[row.bucket] ?? "#0F6B4F"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
