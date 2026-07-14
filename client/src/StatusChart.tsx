import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export default function StatusChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={53} outerRadius={78} paddingAngle={3}>{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" iconType="circle" /></PieChart></ResponsiveContainer>;
}
