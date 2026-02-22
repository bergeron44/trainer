import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import {
  User, Scale, Ruler, Target, Calendar, Clock,
  Dumbbell, Utensils, Moon, LogOut,
  Edit2, RefreshCw, Sparkles, Flame, Zap, Skull
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useAuth } from '@/lib/AuthContext';

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuth();
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const profile = user?.profile;

  const handleSaveField = async () => {
    if (editField && editValue !== '') {
      try {
        await updateProfile({ [editField]: editValue });
        setEditField(null);
      } catch (error) {
        console.error('Failed to update profile:', error);
        // show error toast
      }
    }
  };

  const handleRestartOnboarding = () => {
    // Logic to reset onboarding flag in DB could act here, 
    // but for now we might just redirect or clear specific flags if we had an endpoint
    // Since we are moving to DB, restarting onboarding might mean resetting the profile
    // which is a destructive action.
    // For now, let's just navigate to onboarding but we should probably advise user this might not fully reset DB state without an endpoint
    navigate(createPageUrl('Onboarding'));
  };

  const handleLogout = () => {
    logout();
  };

  const goalLabels = {
    weight_loss: 'Weight Loss',
    muscle_gain: 'Muscle Gain',
    recomp: 'Body Recomposition',
    athletic_performance: 'Athletic Performance'
  };

  const experienceLabels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced'
  };

  const environmentLabels = {
    commercial_gym: 'Commercial Gym',
    home_gym: 'Home Gym',
    bodyweight_park: 'Bodyweight/Park'
  };

  const activityLabels = {
    sedentary: 'Sedentary',
    lightly_active: 'Lightly Active',
    moderately_active: 'Moderately Active',
    very_active: 'Very Active'
  };

  const coachStyles = {
    motivational: { label: 'Motivational', icon: Flame, color: '#CCFF00' },
    spicy: { label: 'Spicy', icon: Zap, color: '#00F2FF' },
    hardcore: { label: 'Hardcore', icon: Skull, color: '#FF6B6B' }
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || Object.keys(profile).length === 0 || !profile.goal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-400 mb-4">You haven't completed your profile setup.</p>
        <Button onClick={() => navigate(createPageUrl('Onboarding'))} className="bg-[#1A1A1A] border border-[#2A2A2A] text-white hover:bg-[#2A2A2A]">
          Complete Onboarding
        </Button>
      </div>
    );
  }

  const profileSections = [
    {
      title: 'AI Coach',
      items: [
        {
          key: 'coach_style',
          label: 'Coach Style',
          value: coachStyles[profile?.coach_style]?.label || 'Motivational',
          icon: Sparkles,
          type: 'select',
          options: [
            ['motivational', 'Motivational - Positive & Encouraging'],
            ['spicy', 'Spicy - Bold & Challenging'],
            ['hardcore', 'Hardcore - No Excuses']
          ]
        }
      ]
    },
    {
      title: 'Body Metrics',
      items: [
        { key: 'weight', label: 'Weight', value: profile?.weight, unit: 'kg', icon: Scale, type: 'number' },
        { key: 'height', label: 'Height', value: profile?.height, unit: 'cm', icon: Ruler, type: 'number' },
        { key: 'body_fat_percentage', label: 'Body Fat', value: profile?.body_fat_percentage, unit: '%', icon: Target, type: 'number' }
      ]
    },
    {
      title: 'Training',
      items: [
        { key: 'goal', label: 'Goal', value: goalLabels[profile?.goal], icon: Target, type: 'select', options: Object.entries(goalLabels) },
        { key: 'experience_level', label: 'Experience', value: experienceLabels[profile?.experience_level], icon: Dumbbell, type: 'select', options: Object.entries(experienceLabels) },
        { key: 'workout_days_per_week', label: 'Days/Week', value: profile?.workout_days_per_week, unit: 'days', icon: Calendar, type: 'number' },
        { key: 'session_duration', label: 'Session Length', value: profile?.session_duration, unit: 'min', icon: Clock, type: 'select', options: [['30', '30 min'], ['60', '60 min'], ['90', '90 min']] },
        { key: 'environment', label: 'Environment', value: environmentLabels[profile?.environment], icon: Dumbbell, type: 'select', options: Object.entries(environmentLabels) }
      ]
    },
    {
      title: 'Nutrition',
      items: [
        { key: 'target_calories', label: 'Daily Calories', value: profile?.target_calories, unit: 'kcal', icon: Utensils, type: 'number' },
        { key: 'protein_goal', label: 'Protein', value: profile?.protein_goal, unit: 'g', icon: Utensils, type: 'number' },
        { key: 'carbs_goal', label: 'Carbs', value: profile?.carbs_goal, unit: 'g', icon: Utensils, type: 'number' },
        { key: 'fat_goal', label: 'Fat', value: profile?.fat_goal, unit: 'g', icon: Utensils, type: 'number' }
      ]
    },
    {
      title: 'Lifestyle',
      items: [
        { key: 'activity_level', label: 'Activity Level', value: activityLabels[profile?.activity_level], icon: Dumbbell, type: 'select', options: Object.entries(activityLabels) },
        { key: 'sleep_hours', label: 'Sleep', value: profile?.sleep_hours, unit: 'hours', icon: Moon, type: 'number' }
      ]
    }
  ];

  const CoachIcon = coachStyles[profile?.coach_style]?.icon || Flame;

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-gray-500 text-sm">Manage your settings</p>
      </motion.div>

      {/* User Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] rounded-2xl p-6 border border-[#2A2A2A] mb-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-cyan flex items-center justify-center">
            <User className="w-8 h-8 text-black" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Fitness Athlete</h2>
            <p className="text-gray-500 text-sm">Demo User</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
                {experienceLabels[profile?.experience_level] || 'Beginner'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#00F2FF]/20 text-[#00F2FF]">
                {goalLabels[profile?.goal] || 'Fitness'}
              </span>
            </div>
          </div>
        </div>

        {profile?.tdee && (
          <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
            <p className="text-sm text-gray-500">Your TDEE (maintenance calories)</p>
            <p className="text-2xl font-bold text-[#00F2FF]">{profile.tdee} kcal</p>
          </div>
        )}
      </motion.div>

      {/* Profile Sections */}
      {profileSections.map((section, sectionIndex) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + sectionIndex * 0.05 }}
          className="mb-6"
        >
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {section.title}
          </h3>
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] divide-y divide-[#2A2A2A]">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setEditField(item.key);
                    setEditValue(profile?.[item.key] || '');
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#2A2A2A]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-400">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {item.value}{item.unit ? ` ${item.unit}` : ''}
                    </span>
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <Button
          onClick={handleRestartOnboarding}
          variant="outline"
          className="w-full h-12 bg-transparent border-[#2A2A2A] text-white hover:bg-[#1A1A1A] hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Restart Onboarding
        </Button>

        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full h-12 bg-transparent border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Clear Data & Restart
        </Button>
      </motion.div>



      {/* Edit Dialog */}
      <Dialog open={!!editField} onOpenChange={() => setEditField(null)}>
        <DialogContent className="bg-[#0A0A0A] border border-[#2A2A2A] text-white">
          <DialogHeader>
            <DialogTitle>Edit {profileSections.flatMap(s => s.items).find(i => i.key === editField)?.label}</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {profileSections.flatMap(s => s.items).find(i => i.key === editField)?.type === 'select' ? (
              <Select value={String(editValue)} onValueChange={setEditValue}>
                <SelectTrigger className="bg-[#1A1A1A] border-[#2A2A2A]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  {profileSections.flatMap(s => s.items).find(i => i.key === editField)?.options?.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : '')}
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
              />
            )}

            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setEditField(null)}
                className="flex-1 bg-transparent border-[#2A2A2A] text-white hover:bg-[#1A1A1A]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveField}
                className="flex-1 gradient-cyan text-black"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}