import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  reviewer: { name: string };
  tasks?: { id?: string; title?: string } | null;
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

        // Fetch reviews (include reviewer info and task title). Do not filter out null comments.
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          // remove nonexistent avatar_url, include task id
          .select('id, rating, comment, created_at, reviewer:reviewer_id(name), tasks:task_id(id, title)')
          .eq('reviewee_id', userId)
          .order('created_at', { ascending: false });
        if (reviewsError) throw reviewsError;
        const allReviews = (reviewsData as any[]) || [];
        setReviews(allReviews);

        // Compute aggregate rating client-side (includes reviews without comments)
        if (allReviews.length) {
          const sum = allReviews.reduce((s, r) => s + (Number(r.rating) || 0), 0);
          const avg = sum / allReviews.length;
          setRating({ average_rating: Number(avg.toFixed(2)), review_count: allReviews.length });
        } else {
          setRating({ average_rating: null, review_count: 0 });
        }

        // NEW: fetch task history (posted tasks)
        const { data: postedTasks, error: postedErr } = await supabase
          .from('tasks')
          .select('id, title, created_at, status, price')
          .eq('poster_id', userId)
          .order('created_at', { ascending: false });
        if (!postedErr) {
          // attach to profile via local state (reuse existing profile/state or create local variable)
          (profileData as any).postedTasks = postedTasks || [];
        }

        // NEW: fetch tasks where this user was the tasker (assignments)
        const { data: assignedRows, error: assignedErr } = await supabase
          .from('task_assignments')
          .select('task_id, completed_at, tasks(id, title, poster_id, price)')
          .eq('tasker_id', userId)
          .order('created_at', { ascending: false });
        if (!assignedErr) {
          (profileData as any).assignedTasks = assignedRows || [];
        }

        // setProfile again with attached tasks
        setProfile(profileData);
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
              {reviews.length > 0 ? (
                // DISPLAY only reviews that have a comment (per requirement)
                reviews
                  .filter(r => r.comment && r.comment.trim() !== '')
                  .map(r => (
                    <div key={r.id} className="border p-4 rounded-lg">
                      <div className="flex items-start gap-4">
                        <Avatar>
+                          {/* no avatar_url column — fallback to initials */}
+                          <AvatarFallback>{r.reviewer.name?.charAt(0) ?? '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-4">
                            <p className="font-semibold">{r.reviewer.name}</p>
                            <StarRating ratingValue={r.rating} />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>
                          {r.tasks?.title && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Task: <Link to={`/tasks/${(r as any).tasks.id}`}>{r.tasks.title}</Link>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No reviews to display.</p>
              )}
            </div>
          </TabsContent>
              <TabsContent value="tasks">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Posted Tasks</h3>
                    { (profile as any)?.postedTasks?.length ? (
                      <div className="grid gap-3">
                        {(profile as any).postedTasks.map((t: any) => (
                          <Card key={t.id}><CardContent className="flex justify-between items-center"><div>
                            <div className="font-medium">{t.title}</div>
                            <div className="text-sm text-muted-foreground">{t.status} • ₹{t.price}</div>
                          </div>
                          <div className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</div>
                          </CardContent></Card>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No posted tasks.</p> }
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Assigned Tasks</h3>
                    { (profile as any)?.assignedTasks?.length ? (
                      <div className="grid gap-3">
                        {(profile as any).assignedTasks.map((a: any) => (
                          <Card key={a.task_id}><CardContent className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{a.tasks?.title}</div>
                              <div className="text-sm text-muted-foreground">Completed: {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : 'No'}</div>
                            </div>
                            <div className="text-sm text-muted-foreground">Task ID: {a.task_id}</div>
                          </CardContent></Card>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No assigned tasks.</p> }
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
