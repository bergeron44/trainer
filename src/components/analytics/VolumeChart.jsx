import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function VolumeChart({ data }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-[#CCFF00]">{payload[0].value.toLocaleString()} kg</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A]">
      <h3 className="font-semibold mb-1">Weekly Volume</h3>
      <p className="text-xs text-gray-500 mb-4">Total kg lifted</p>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis 
              dataKey="week" 
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
            <Bar
              dataKey="volume"
              fill="#CCFF00"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}