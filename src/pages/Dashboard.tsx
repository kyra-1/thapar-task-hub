import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, DollarSign, User, LogOut, Star, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import CreateTaskModal from '@/components/CreateTaskModal';
import ReviewModal from '@/components/ReviewModal';

// --- TYPE DEFINITIONS ---
interface TaskerProfile {
  id: string;
  name: string;
  phone: string | null;
}

interface MyTaskAssignment {
  tasker_id: string;
  completed_at: string | null;
  users: TaskerProfile | null; // Tasker's info can be null
}

interface Task {
  id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  deadline: string;
  created_at: string;
  poster_id: string;
  users?: { name: string }; // Poster's name
  task_assignments?: MyTaskAssignment[];
}

interface AssignedTaskData {
    id: string;
    tasks: Task | null;
}

// --- COMPONENT ---
const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // NEW: store reviews submitted by the current user (to avoid multiple reviews per task)
  const [myReviews, setMyReviews] = useState<{ task_id: string; reviewer_id: string }[]>([]);

  const fetchMyReviews = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('task_id, reviewer_id')
        .eq('reviewer_id', user.id);
      if (error) throw error;
      setMyReviews((data as any[]) || []);
    } catch (err: any) {
      console.error('Error fetching my reviews:', err);
    }
  };

  const fetchAllData = useCallback(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchTasks(),
      fetchMyTasks(),
      fetchAssignedTasks(),
      fetchMyReviews() // ensure myReviews loaded together
    ]).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      fetchAllData();
    }
  }, [user, navigate, fetchAllData]);

  const fetchMyTasks = async () => {
  if (!user) return;
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_assignments (
          id,
          tasker_id,
          completed_at,
          users:tasker_id (
            id,
            name
          )
        )
      `)
      .eq('poster_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setMyTasks((data as unknown as Task[]) || []);
  } catch (err: any) {
    console.error("Error fetching my tasks:", err?.message || err);
    toast({
      title: 'Error',
      description: err?.message || 'Failed to fetch your tasks',
      variant: 'destructive'
    });
  }
};

const fetchTasks = async () => {
  if (!user) return;
  try {
    // Only fetch open tasks not posted by the current user
    const { data, error } = await supabase
      .from('tasks')
      .select(`*, users:poster_id (name)`)
      .eq('status', 'open')
      .neq('poster_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setTasks(data as Task[] || []);
  } catch (error) {
    console.error("Error fetching open tasks:", error)
    toast({ title: 'Error', description: 'Failed to fetch tasks', variant: 'destructive' });
  }
};

const fetchAssignedTasks = async () => {
  if (!user) return;
  try {
    const { data, error } = await supabase
      .from('task_assignments')
      .select(`
        id,
        accepted_at,
        completed_at,
        tasks (
          id,
          title,
          description,
          price,
          poster_id,
          users:poster_id (id, name, phone)
        ),
        users!task_assignments_tasker_id_fkey (id, name, phone)
      `)
      .eq('tasker_id', user.id);

    if (error) throw error;

    const assignments = (data as any[]) || [];

    // If poster info is missing in some rows, batch-fetch poster profiles and attach them.
    const missingPosterIds = Array.from(
      new Set(
        assignments
          .map(a => a.tasks?.poster_id)
          .filter(Boolean)
          .filter(pid => !assignments.some(a => a.tasks?.poster_id === pid && a.tasks?.users?.name))
      )
    );

    let posterMap: Record<string, any> = {};
    if (missingPosterIds.length) {
      const { data: posters, error: postersError } = await supabase
        .from('users')
        .select('id, name, phone')
        .in('id', missingPosterIds);
      if (!postersError && posters) {
        posterMap = (posters as any[]).reduce((m, p) => ((m[p.id] = p), m), {} as Record<string, any>);
      }
    }

    const normalized = assignments.map(a => {
      const t = a.tasks || null;
      if (t) {
        // prefer nested users (returned by supabase join), fallback to posterMap
        if (!t.users && posterMap[t.poster_id]) {
          t.users = { id: posterMap[t.poster_id].id, name: posterMap[t.poster_id].name, phone: posterMap[t.poster_id].phone };
        }
      }
      return { ...a, tasks: t };
    });

    setAssignedTasks(normalized as unknown as AssignedTaskData[]);
  } catch (err: any) {
    console.error("Error fetching assigned tasks:", err?.message || err);
    toast({
      title: 'Error',
      description: err?.message || 'Failed to fetch assigned tasks',
      variant: 'destructive'
    });
  }
};

  const acceptTask = async (taskId: string) => {
  if (!user) return;
  try {
    const { error: assignError } = await supabase
      .from('task_assignments')
      .insert({ task_id: taskId, tasker_id: user.id });

    if (assignError) throw assignError;

    toast({ title: 'Task Accepted!', description: 'The poster has been notified. You can find this task under "Assigned to Me".' });

    // Refresh immediately
    fetchAllData();

    // Re-check shortly after to ensure DB trigger (status update) is reflected for everyone
    setTimeout(() => {
      fetchAllData();
    }, 700);
  } catch (error: any) {
    console.error("Accept task error:", error);
    toast({ title: 'Error', description: 'Failed to accept task', variant: 'destructive' });
  }
};
  
  const markTaskComplete = async (taskId: string) => {
  if (!user) return;
  try {
    // Call server-side RPC which validates auth and sets completed_at + task status
    // pass parameter name p_task_id to match the RPC signature
    const { data, error } = await (supabase as any).rpc('mark_task_completed', { p_task_id: taskId });

    if (error) throw error;

    toast({ title: 'Task Completed!', description: 'You can now review the tasker.' });
    fetchAllData();
  } catch (err: any) {
    console.error('Mark complete error:', err);
    toast({ title: 'Error', description: err?.message || 'Failed to mark task as complete.', variant: 'destructive' });
  }
};

const markTaskUnassign = async (taskId: string) => {
  if (!user) return;
  try {
    const { error } = await (supabase as any).rpc('mark_task_unassign', { p_task_id: taskId });
    if (error) throw error;
    toast({ title: 'Task Unassigned', description: 'The task is open again for others to accept.' });
    fetchAllData();
  } catch (err: any) {
    console.error('Unassign task error:', err);
    toast({ title: 'Error', description: err?.message || 'Failed to unassign task', variant: 'destructive' });
  }
};

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'accepted': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const TaskCard = ({ task, type }: { task: Task, type: 'browse' | 'my-tasks' | 'assigned-to-me' }) => {
  const tasker = task.task_assignments?.[0]?.users;

  // NEW: determine if current user already submitted a review for this task
  const alreadyReviewed = user ? myReviews.some(r => r.task_id === task.id && r.reviewer_id === user.id) : false;

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
        <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{task.title}</CardTitle>
                <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
            </div>
            <CardDescription className="flex items-center gap-1 pt-1">
                <User className="h-3 w-3" />
                Posted by:
                <Link to={`/profile/${task.poster_id}`} className="hover:underline font-medium text-primary">
                    {type === 'my-tasks' ? 'You' : task.users?.name || 'Anonymous'}
                </Link>
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 flex-grow flex flex-col justify-between">
            <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">{task.description || 'No description provided.'}</p>
            <div>
                {tasker && type === 'my-tasks' && (
                    <div className="text-sm text-muted-foreground border-t pt-3 mt-3">
                        Assigned to: {' '}
                        <Link to={`/profile/${tasker.id}`} className="font-medium text-primary hover:underline">{tasker.name}</Link>
                    </div>
                )}
                <div className="flex justify-between items-center my-3">
                    <div className="flex items-center gap-1 text-lg font-semibold text-green-600">
                        <DollarSign className="h-4 w-4" />₹{task.price}
                    </div>
                    {task.deadline && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.deadline).toLocaleDateString()}
                    </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {type === 'browse' && <Button onClick={() => acceptTask(task.id)} className="w-full" size="sm">Accept Task</Button>}
                  
                  {type === 'my-tasks' && task.status === 'accepted' && (
                    <>
                        <div className="flex flex-col gap-2">
                          <Button onClick={() => markTaskComplete(task.id)} className="w-full" size="sm">Mark as Complete</Button>

                          {/* Unassign only shown for accepted tasks that are not completed */}
                          {!(task.task_assignments?.[0]?.completed_at) && (
                            <Button variant="outline" onClick={() => markTaskUnassign(task.id)} className="w-full" size="sm">
                              Unassign
                            </Button>
                          )}

                          {tasker?.phone && (
                            <Button asChild variant="outline" className="w-full" size="sm">
                              <a href={`https://wa.me/${tasker.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                <MessageSquare className="h-4 w-4 mr-2" /> Contact on WhatsApp
                              </a>
                            </Button>
                          )}
                        </div>
                    </>
                  )}

                  {/* SHOW Leave Review only when task completed AND current user has not already reviewed this task */}
                  { (type === 'my-tasks' || type === 'assigned-to-me') &&
                    task.task_assignments?.[0]?.completed_at && !alreadyReviewed &&
                    <Button variant="outline" className="w-full" size="sm" onClick={() => { setSelectedTask(task); setReviewModalOpen(true); }}>
                      <Star className="h-4 w-4 mr-2" /> Leave Review
                    </Button>
                  }
                  {/* If already reviewed, show disabled label */}
                  { (type === 'my-tasks' || type === 'assigned-to-me') &&
                    task.task_assignments?.[0]?.completed_at && alreadyReviewed &&
                    <Button variant="ghost" disabled className="w-full" size="sm">Review Submitted</Button>
                  }
                </div>
            </div>
        </CardContent>
    </Card>
  );
};

  // --- REVIEW HANDLING ---
  // Moved here so hooks are always called in same order (before any early return)
  const handleOnReviewSubmitted = useCallback(() => {
    setReviewModalOpen(false);
    setSelectedTask(null);
    fetchAllData();
    toast({ title: 'Review submitted!', description: 'Thank you for your feedback.' });
  }, [fetchAllData, toast]);

  // compute safe reviewee id for the modal (non-hook)
  let computedRevieweeId = '';
  if (selectedTask && user) {
    computedRevieweeId =
      user.id === selectedTask.poster_id
        ? selectedTask.task_assignments?.[0]?.tasker_id ?? ''
        : selectedTask.poster_id ?? '';
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">Thapar Tasker</h1>
              <p className="text-sm text-muted-foreground">Welcome, {user?.user_metadata.name || user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => navigate(`/profile/${user?.id}`)} variant="ghost" size="sm">My Profile</Button>
              <Button onClick={handleSignOut} variant="outline" size="sm"><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="browse" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse">Browse Tasks</TabsTrigger>
            <TabsTrigger value="my-tasks">My Posted Tasks</TabsTrigger>
            <TabsTrigger value="assigned-tasks">Assigned to Me</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tasks.map((task) => <TaskCard key={task.id} task={task} type="browse" />)}
            </div>
            {tasks.length === 0 && <Card className="text-center py-12"><CardContent><p>No tasks available right now.</p></CardContent></Card>}
          </TabsContent>

          <TabsContent value="my-tasks">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setCreateModalOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Task</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myTasks.map((task) => <TaskCard key={task.id} task={task} type="my-tasks" />)}
            </div>
            {myTasks.length === 0 && <Card className="text-center py-12"><CardContent><p>You haven't posted any tasks yet.</p></CardContent></Card>}
          </TabsContent>
          
          <TabsContent value="assigned-tasks">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignedTasks.filter(a => a.tasks).map((assignment) => (
                <TaskCard key={assignment.id} task={assignment.tasks!} type="assigned-to-me" />
              ))}
            </div>
            {assignedTasks.length === 0 && <Card className="text-center py-12"><CardContent><p>You haven't accepted any tasks yet.</p></CardContent></Card>}
          </TabsContent>
        </Tabs>
      </main>

      <CreateTaskModal open={createModalOpen} onOpenChange={setCreateModalOpen} onTaskCreated={() => { fetchMyTasks(); setCreateModalOpen(false); }} />
      {selectedTask && user && computedRevieweeId && (
        <ReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          taskId={selectedTask.id}
          reviewerId={user.id}
          revieweeId={computedRevieweeId}
          onReviewSubmitted={handleOnReviewSubmitted}
        />
      )}
    </div>
  );
};

export default Dashboard;