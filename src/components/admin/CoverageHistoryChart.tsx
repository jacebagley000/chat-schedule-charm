import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoverageHistoryPoint } from "@/lib/search-console.functions";

function formatDay(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CoverageHistoryChart({
  points,
  isLoading,
}: {
  points: CoverageHistoryPoint[];
  isLoading?: boolean;
}) {
  const maxY = useMemo(
    () => Math.max(1, ...points.map((p) => Math.max(p.allowlisted, p.crawled, p.indexed))),
    [points],
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Indexed routes over time</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isLoading
              ? "Loading history…"
              : "History builds up one point per day — refresh coverage again tomorrow to see the trend."}
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="indexedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, maxY]}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  labelFormatter={(label) => formatDay(String(label))}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="allowlisted"
                  name="Allowlisted"
                  stroke="hsl(var(--muted-foreground))"
                  fill="none"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="crawled"
                  name="Crawled"
                  stroke="hsl(var(--chart-2, var(--muted-foreground)))"
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="indexed"
                  name="Indexed"
                  stroke="hsl(var(--primary))"
                  fill="url(#indexedFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
