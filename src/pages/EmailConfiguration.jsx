import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, CheckCircle2, ExternalLink, Code, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmailConfiguration() {
  const [copiedText, setCopiedText] = useState('');

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Email Configuration</h1>
        <p className="text-slate-500 mt-1">Setup custom email for app invitations</p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Mail className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <strong>Current Status:</strong> Without custom email setup, the system uses Base44's built-in email (from noreply@base44.com). 
          Configure a custom email service below for branded emails from your domain.
          <br /><br />
          <strong>To add API keys:</strong> Open your Base44 builder → Click the ⚙️ icon in the bottom left → Settings → Environment Variables
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="resend" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="resend">
            <Mail className="h-4 w-4 mr-2" />
            Resend (Recommended)
          </TabsTrigger>
          <TabsTrigger value="sendgrid">SendGrid</TabsTrigger>
        </TabsList>

        <TabsContent value="resend" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Resend Setup (Recommended)
              </CardTitle>
              <CardDescription>Easy setup, 100 emails/day free tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">1</div>
                  <h3 className="font-semibold text-slate-900">Sign up for Resend</h3>
                </div>
                <div className="ml-9 space-y-2">
                  <p className="text-sm text-slate-600">Create a free account at Resend</p>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://resend.com" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Open Resend.com
                    </a>
                  </Button>
                </div>
              </div>

              {/* Step 2 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">2</div>
                  <h3 className="font-semibold text-slate-900">Get API Key</h3>
                </div>
                <div className="ml-9 space-y-2">
                  <p className="text-sm text-slate-600">Go to API Keys section and create a new key</p>
                  <p className="text-xs text-slate-500">The key will start with <code className="bg-slate-100 px-1 rounded">re_...</code></p>
                </div>
              </div>

              {/* Step 3 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">3</div>
                  <h3 className="font-semibold text-slate-900">Add Secrets to Base44</h3>
                </div>
                <div className="ml-9 space-y-3">
                  <p className="text-sm text-slate-600">Go to your Base44 app Dashboard → Settings → Environment Variables and add:</p>
                  
                  <div className="space-y-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-sm font-mono text-slate-700">RESEND_API_KEY</code>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard('RESEND_API_KEY', 'key1')}
                        >
                          {copiedText === 'key1' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Code className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">Value: Your Resend API key (re_...)</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-sm font-mono text-slate-700">CUSTOM_EMAIL_FROM</code>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard('CUSTOM_EMAIL_FROM', 'key2')}
                        >
                          {copiedText === 'key2' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Code className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">Value: noreply@alpha-jachting.hr (or your domain)</p>
                    </div>
                  </div>

                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertDescription className="text-sm text-amber-800">
                      <strong>Note:</strong> You may need to verify your domain in Resend before sending from a custom email address. 
                      Use their test domain for initial testing.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>

              {/* Step 4 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold">✓</div>
                  <h3 className="font-semibold text-slate-900">Done!</h3>
                </div>
                <div className="ml-9">
                  <p className="text-sm text-slate-600">
                    The system will automatically detect the API key and use Resend for all invitation emails with beautiful HTML templates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sendgrid" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                SendGrid Setup
              </CardTitle>
              <CardDescription>Alternative email service, 100 emails/day free tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">1</div>
                  <h3 className="font-semibold text-slate-900">Sign up for SendGrid</h3>
                </div>
                <div className="ml-9 space-y-2">
                  <p className="text-sm text-slate-600">Create a free account at SendGrid</p>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Open SendGrid.com
                    </a>
                  </Button>
                </div>
              </div>

              {/* Step 2 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">2</div>
                  <h3 className="font-semibold text-slate-900">Create API Key</h3>
                </div>
                <div className="ml-9 space-y-2">
                  <p className="text-sm text-slate-600">Go to Settings → API Keys and create a new key with "Mail Send" permissions</p>
                  <p className="text-xs text-slate-500">The key will start with <code className="bg-slate-100 px-1 rounded">SG.</code></p>
                </div>
              </div>

              {/* Step 3 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">3</div>
                  <h3 className="font-semibold text-slate-900">Add Secrets to Base44</h3>
                </div>
                <div className="ml-9 space-y-3">
                  <p className="text-sm text-slate-600">Go to Base44 Dashboard → Settings → Environment Variables and add:</p>
                  
                  <div className="space-y-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-sm font-mono text-slate-700">SENDGRID_API_KEY</code>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard('SENDGRID_API_KEY', 'sgkey1')}
                        >
                          {copiedText === 'sgkey1' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Code className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">Value: Your SendGrid API key (SG.)</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-sm font-mono text-slate-700">CUSTOM_EMAIL_FROM</code>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard('CUSTOM_EMAIL_FROM', 'sgkey2')}
                        >
                          {copiedText === 'sgkey2' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Code className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">Value: noreply@alpha-jachting.hr (or your domain)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold">✓</div>
                  <h3 className="font-semibold text-slate-900">Done!</h3>
                </div>
                <div className="ml-9">
                  <p className="text-sm text-slate-600">
                    The system will automatically use SendGrid for sending invitation emails with HTML templates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Testing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Testing & Troubleshooting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-slate-900 mb-2">Test Your Setup</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
              <li>Go to App Invitations page</li>
              <li>Send a test invite to yourself</li>
              <li>Check your email (including spam folder)</li>
              <li>Verify the email has your custom branding</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-slate-900 mb-2">Common Issues</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="text-amber-600">•</span>
                <span><strong>Emails not arriving:</strong> Check spam folder, verify API key is correct, check email service dashboard for delivery logs</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600">•</span>
                <span><strong>Domain not verified:</strong> Most services require domain verification for production use. Use test domain for development.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600">•</span>
                <span><strong>Rate limits:</strong> Free tiers have daily limits. Upgrade plan if needed for production.</span>
              </li>
            </ul>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-sm text-blue-800">
              <strong>Fallback Behavior:</strong> If no custom email service is configured, the system will automatically 
              fall back to Base44's built-in email service. Your invites will still work, just without custom branding.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}