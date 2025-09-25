import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, DollarSign, User, LogOut, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import CreateTaskModal from '@/components/CreateTaskModal';
import ReviewModal from '@/components/ReviewModal';

interface Task {
  id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  deadline: string;
  created_at: string;
  poster_id: string;
  users?: { name: string };
  task_assignments: { tasker_id: string }[];
}

interface AssignedTask extends Task {
  task_assignments: { tasker_id: string, completed_at: string | null }[];
}


const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<AssignedTask[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<AssignedTask | null>(null);

  const fetchAllData = useCallback(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchTasks(),
      fetchMyTasks(),
      fetchAssignedTasks()
    ]).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      fetchAllData();
    }
  }, [user, navigate, fetchAllData]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, users:poster_id (name)`)
        .eq('status', 'open')
        .neq('poster_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch tasks', variant: 'destructive' });
    }
  };

  const fetchMyTasks = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignments(tasker_id, completed_at)')
        .eq('poster_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyTasks(data as AssignedTask[] || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch your tasks', variant: 'destructive' });
    }
  };

  const fetchAssignedTasks = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, users:poster_id(name), task_assignments!inner(tasker_id, completed_at)')
        .eq('task_assignments.tasker_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAssignedTasks(data as AssignedTask[] || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch assigned tasks', variant: 'destructive' });
    }
  };

  const acceptTask = async (taskId: string) => {
    if (!user) return;
    try {
      const { error: assignError } = await supabase.from('task_assignments').insert({ task_id: taskId, tasker_id: user.id });
      if (assignError) throw assignError;
      const { error: updateError } = await supabase.from('tasks').update({ status: 'accepted' }).eq('id', taskId);
      if (updateError) throw updateError;
      toast({ title: 'Task Accepted!', description: 'You have successfully accepted this task.' });
      fetchAllData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to accept task', variant: 'destructive' });
    }
  };
  
  const markTaskComplete = async (taskId: string) => {
    if (!user) return;
    try {
      const { error: updateAssignError } = await supabase
        .from('task_assignments')
        .update({ completed_at: new Date().toISOString() })
        .eq('task_id', taskId);
      if (updateAssignError) throw updateAssignError;

      const { error: updateTaskError } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);
      if (updateTaskError) throw updateTaskError;

      toast({ title: 'Task Completed!', description: 'You can now review the tasker.' });
      fetchAllData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to mark task as complete.', variant: 'destructive' });
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
  
  const TaskCard = ({ task, type }: { task: AssignedTask, type: 'browse' | 'my-tasks' | 'assigned-to-me' }) => (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{task.title}</CardTitle>
          <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
        </div>
        <CardDescription className="flex items-center gap-1 pt-1">
          <User className="h-3 w-3" />
          <Link to={`/profile/${task.poster_id}`} className="hover:underline">
            {type === 'assigned-to-me' ? task.users?.name : 'You'}
            {type === 'browse' && (task.users?.name || 'Anonymous')}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 flex-grow flex flex-col justify-between">
        <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
        <div>
            <div className="flex justify-between items-center mb-3">
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
            {type === 'browse' && <Button onClick={() => acceptTask(task.id)} className="w-full" size="sm">Accept Task</Button>}
            {type === 'my-tasks' && task.status === 'accepted' && <Button onClick={() => markTaskComplete(task.id)} className="w-full" size="sm">Mark as Complete</Button>}
            {type === 'my-tasks' && task.status === 'completed' && 
                <Button variant="outline" className="w-full" size="sm" onClick={() => { setSelectedTask(task); setReviewModalOpen(true); }}>
                    <Star className="h-4 w-4 mr-2" /> Leave Review
                </Button>
            }
            {type === 'assigned-to-me' && task.status === 'completed' &&
                <Button variant="outline" className="w-full" size="sm" onClick={() => { setSelectedTask(task); setReviewModalOpen(true); }}>
                    <Star className="h-4 w-4 mr-2" /> Leave Review
                </Button>
            }
        </div>
      </CardContent>
    </Card>
  );

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
              {tasks.map((task) => <TaskCard key={task.id} task={task as AssignedTask} type="browse" />)}
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
              {assignedTasks.map((task) => <TaskCard key={task.id} task={task} type="assigned-to-me" />)}
            </div>
            {assignedTasks.length === 0 && <Card className="text-center py-12"><CardContent><p>You haven't accepted any tasks yet.</p></CardContent></Card>}
          </TabsContent>
        </Tabs>
      </main>

      <CreateTaskModal open={createModalOpen} onOpenChange={setCreateModalOpen} onTaskCreated={() => { fetchMyTasks(); setCreateModalOpen(false); }} />
      {selectedTask && user && (
        <ReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          taskId={selectedTask.id}
          reviewerId={user.id}
          revieweeId={user.id === selectedTask.poster_id ? selectedTask.task_assignments[0].tasker_id : selectedTask.poster_id}
          onReviewSubmitted={() => {
            setReviewModalOpen(false);
            setSelectedTask(null);
            // Optionally, refresh reviews data on profile or here
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
