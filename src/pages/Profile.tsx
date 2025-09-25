import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface UserProfile {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  email?: string;
}

interface UserRating {
  average_rating: number | null;
  review_count: number | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { name: string, avatar_url: string | null };
}

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rating, setRating] = useState<UserRating | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);
        
        // Fetch user auth email if it's the current user
        if (currentUser && currentUser.id === userId) {
            setProfile(p => p ? {...p, email: currentUser.email} : null);
        }

        // Fetch user ratings
        const { data: ratingData, error: ratingError } = await supabase
          .from('user_ratings')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (ratingError && ratingError.code !== 'PGRST116') throw ratingError; // Ignore no rows found
        setRating(ratingData);

        // Fetch reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('*, reviewer:reviewer_id(name, avatar_url)')
          .eq('reviewee_id', userId)
          .order('created_at', { ascending: false });
        if (reviewsError) throw reviewsError;
        setReviews(reviewsData as any);

      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, navigate, currentUser]);

  const StarRating = ({ ratingValue }: { ratingValue: number }) => (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`h-5 w-5 ${i < Math.round(ratingValue) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
  
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center"><p>User not found.</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
    <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-primary">User Profile</h1>
            <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
    </header>
      <main className="max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader className="flex flex-col md:flex-row items-center gap-6 p-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || ''} alt={profile.name} />
              <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
            </Avatar>
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-bold">{profile.name}</h2>
              {profile.email && <p className="text-muted-foreground">{profile.email}</p>}
              <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                {rating?.average_rating ? (
                  <>
                    <StarRating ratingValue={rating.average_rating} />
                    <span className="text-muted-foreground">({rating.review_count} reviews)</span>
                  </>
                ) : (
                  <Badge variant="outline">No reviews yet</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="reviews">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              <TabsContent value="reviews" className="mt-4">
                <div className="space-y-4">
                  {reviews.length > 0 ? reviews.map(r => (
                    <div key={r.id} className="border p-4 rounded-lg">
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarImage src={r.reviewer.avatar_url || ''} />
                          <AvatarFallback>{r.reviewer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="flex items-center gap-4">
                                <p className="font-semibold">{r.reviewer.name}</p>
                                <StarRating ratingValue={r.rating} />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>
                            <p className="text-xs text-muted-foreground mt-2">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  )) : <p className="text-center text-muted-foreground py-4">No reviews to display.</p>}
                </div>
              </TabsContent>
              <TabsContent value="tasks">
                <p className="text-center text-muted-foreground py-4">Task history will be shown here.</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
