
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Info, Users, ExternalLink, Sparkles } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-background text-foreground">
      <Card className="w-full max-w-2xl shadow-2xl bg-card text-card-foreground">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tight">
            About VoiceTasker
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-1">
            Learn more about the app and its creators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-2 flex items-center">
              <Info className="h-6 w-6 mr-2 text-accent" />
              What is VoiceTasker?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              VoiceTasker is an intelligent to-do list application that allows you to manage your tasks using voice commands.
              Powered by cutting-edge AI, it can understand your spoken tasks, extract due dates and times, and even remind you with notifications.
              Our goal is to make task management effortless and intuitive, helping you stay organized and productive.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2 flex items-center">
              <Users className="h-6 w-6 mr-2 text-accent" />
              Meet the Developers
            </h2>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p>
                This application was brought to life by a passionate team dedicated to exploring the intersection of AI and everyday productivity.
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Image
                    src="/chamindu.jpeg"
                    alt="Chamindu Kavishka"
                    width={80}
                    height={80}
                    className="rounded-full shadow-md"
                    data-ai-hint="profile portrait"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Chamindu Kavishka</h3>
                    <Button variant="link" size="sm" asChild className="p-0 h-auto text-accent hover:text-accent/80">
                      <a href="https://chamindu1.vercel.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                        chamindu1.vercel.app <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Image
                    src="/me.png"
                    alt="Maheshika Devindya"
                    width={80}
                    height={80}
                    className="rounded-full shadow-md"
                    data-ai-hint="profile portrait"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Maheshika Devindya</h3>
                    <Button variant="link" size="sm" asChild className="p-0 h-auto text-accent hover:text-accent/80">
                      <a href="https://maheshika1.vercel.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                        maheshika1.vercel.app <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="text-center mt-8">
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} VoiceTasker. All rights reserved.</p>
      </footer>
    </div>
  );
}
