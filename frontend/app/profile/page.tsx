"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, AlertCircle, CheckCircle, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

interface Profile {
  id: string;
  github_id: number;
  github_login: string;
  github_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  company?: string;
  location?: string;
  blog?: string;
  subscription_tier: string;
  coins_balance: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    github_name: "",
    bio: "",
    company: "",
    location: "",
    blog: "",
  });

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMyProfile();
      setProfile(data);

      // Populate form with existing data
      setFormData({
        email: data.email || "",
        phone: data.phone || "",
        github_name: data.github_name || "",
        bio: data.bio || "",
        company: data.company || "",
        location: data.location || "",
        blog: data.blog || "",
      });
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    // Phone validation
    if (formData.phone) {
      const phoneRegex = /^\+\d{10,15}$/;
      if (!phoneRegex.test(formData.phone.replace(/[\s\-\(\)]/g, ""))) {
        newErrors.phone =
          "Phone number must be in international format (e.g., +919876543210)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the validation errors");
      return;
    }

    try {
      setIsSaving(true);

      // Clean phone number (remove spaces and separators)
      const cleanedData = {
        ...formData,
        phone: formData.phone ? formData.phone.replace(/[\s\-\(\)]/g, "") : undefined,
      };

      const updatedProfile = await api.updateMyProfile(cleanedData);
      setProfile(updatedProfile);

      toast.success("Profile updated successfully!");

      // Refresh the page data
      await loadProfile();
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-16 w-16 animate-spin text-cyan-500" />
                <h2 className="text-2xl font-semibold">Loading Profile...</h2>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const missingRequiredFields = !formData.email || !formData.phone;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt={profile.github_login}
              className="h-20 w-20 rounded-full"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold">Edit Profile</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your account information
            </p>
          </div>
        </div>

        {/* Payment Requirements Alert */}
        {missingRequiredFields && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-900 dark:text-amber-100">
              <strong>Email and phone number are required for payment processing.</strong>
              <br />
              Please add them to enable credit purchases.
            </AlertDescription>
          </Alert>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Update your profile details. Email and phone are required for payments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* GitHub Info (Read-only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">
                    GitHub Username
                  </Label>
                  <div className="font-medium">{profile?.github_login}</div>
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">
                    Subscription
                  </Label>
                  <div className="font-medium capitalize">
                    {profile?.subscription_tier}
                  </div>
                </div>
              </div>

              {/* Email (Required for payments) */}
              <div>
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={errors.email ? "border-red-500" : ""}
                  required
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Required for payment processing and notifications
                </p>
              </div>

              {/* Phone (Required for payments) */}
              <div>
                <Label htmlFor="phone">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+919876543210"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className={errors.phone ? "border-red-500" : ""}
                  required
                />
                {errors.phone && (
                  <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Required for payment processing (include country code, e.g., +91)
                </p>
              </div>

              {/* Optional Fields */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Optional Information</h3>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="github_name">Display Name</Label>
                    <Input
                      id="github_name"
                      placeholder="Your Name"
                      value={formData.github_name}
                      onChange={(e) => handleChange("github_name", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      placeholder="Your Company"
                      value={formData.company}
                      onChange={(e) => handleChange("company", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="City, Country"
                      value={formData.location}
                      onChange={(e) => handleChange("location", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="blog">Website/Blog</Label>
                    <Input
                      id="blog"
                      type="url"
                      placeholder="https://yourwebsite.com"
                      value={formData.blog}
                      onChange={(e) => handleChange("blog", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      placeholder="Tell us about yourself..."
                      value={formData.bio}
                      onChange={(e) => handleChange("bio", e.target.value)}
                      rows={4}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.bio.length}/500 characters
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/")}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
