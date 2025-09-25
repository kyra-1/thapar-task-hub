import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Users, Zap, Star } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-primary mb-6">
              Thapar Tasker
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              The hyperlocal marketplace connecting Thapar students. 
              Post tasks, earn money, help your campus community.
            </p>
            <div className="space-x-4">
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="text-lg px-8 py-3"
              >
                Get Started
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/auth')}
                className="text-lg px-8 py-3"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">How it works</h2>
          <p className="text-lg text-muted-foreground">Simple, safe, and built for campus life</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Post Tasks</CardTitle>
              <CardDescription>
                Need help with printing, errands, or deliveries? Post your task with a fair price.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Browse & Accept</CardTitle>
              <CardDescription>
                Find tasks that match your skills and schedule. Accept and start earning.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Complete Tasks</CardTitle>
              <CardDescription>
                Finish the task, get paid, and build your reputation in the community.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Star className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Rate & Review</CardTitle>
              <CardDescription>
                Build trust through ratings and reviews for better future collaborations.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of Thapar students already helping each other
          </p>
          <Button 
            size="lg"
            variant="secondary"
            onClick={() => navigate('/auth')}
            className="text-lg px-8 py-3"
          >
            Create Your Account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
