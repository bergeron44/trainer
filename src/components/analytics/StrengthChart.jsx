import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StrengthChart({ data, exercise }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-[#00F2FF]">{payload[0].value} kg</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A]">
      <h3 className="font-semibold mb-1">{exercise}</h3>
      <p className="text-xs text-gray-500 mb-4">Strength progression</p>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis 
              dataKey="date" 
              stroke="#666"
              tick={{ fill: '#666', fontSize: 10 }}
              axisLine={{ stroke: '#2A2A2A' }}
            />
            <YAxis 
              stroke="#666"
              tick={{ fill: '#666', fontSize: 10 }}
              axisLine={{ stroke: '#2A2A2A' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#00F2FF"
              strokeWidth={2}
              dot={{ fill: '#00F2FF', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#CCFF00' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}