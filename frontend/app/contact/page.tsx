"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    // TODO: Integrate with backend API for contact form submission
    await new Promise((resolve) => setTimeout(resolve, 1500));

    toast.success("Message sent successfully! We'll get back to you soon.");

    // Reset form
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: "",
    });

    setIsSubmitting(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Contact Info Cards */}
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-cyan-500/10 rounded-full">
                  <Mail className="h-6 w-6 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Email</h3>
                  <a
                    href="mailto:info@tediux.com"
                    className="text-sm text-cyan-500 hover:underline"
                  >
                    info@tediux.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <MessageSquare className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Live Chat</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Available Mon-Fri, 9am-5pm EST
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <Send className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Response Time</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Usually within 24 hours
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle>Send us a Message</CardTitle>
            <CardDescription>
              Fill out the form below and we'll get back to you as soon as possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  placeholder="What is this regarding?"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Tell us more about your inquiry..."
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
