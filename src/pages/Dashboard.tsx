import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, DollarSign, User, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import CreateTaskModal from '@/components/CreateTaskModal';

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
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchTasks();
    fetchMyTasks();
  }, [user, navigate]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          users:poster_id (name)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      });
    }
  };

  const fetchMyTasks = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('poster_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyTasks(data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch your tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptTask = async (taskId: string) => {
    if (!user) return;

    try {
      // Create task assignment
      const { error: assignError } = await supabase
        .from('task_assignments')
        .insert({
          task_id: taskId,
          tasker_id: user.id,
        });

      if (assignError) throw assignError;

      // Update task status
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'accepted' })
        .eq('id', taskId);

      if (updateError) throw updateError;

      toast({
        title: 'Task Accepted!',
        description: 'You have successfully accepted this task.',
      });

      fetchTasks();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept task',
        variant: 'destructive',
      });
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">Thapar Tasker</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.email}</p>
            </div>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="browse" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse Tasks</TabsTrigger>
            <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Available Tasks</h2>
                <p className="text-muted-foreground">Find tasks posted by fellow students</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tasks.map((task) => (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {task.users?.name || 'Anonymous'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 text-lg font-semibold text-green-600">
                        <DollarSign className="h-4 w-4" />
                        ₹{task.price}
                      </div>
                      {task.deadline && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <Button 
                      onClick={() => acceptTask(task.id)}
                      className="w-full"
                      size="sm"
                    >
                      Accept Task
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {tasks.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">No tasks available right now.</p>
                  <p className="text-sm text-muted-foreground mt-2">Check back later for new opportunities!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="my-tasks" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">My Posted Tasks</h2>
                <p className="text-muted-foreground">Manage your task postings</p>
              </div>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myTasks.map((task) => (
                <Card key={task.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 text-lg font-semibold text-green-600">
                        <DollarSign className="h-4 w-4" />
                        ₹{task.price}
                      </div>
                      {task.deadline && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Posted {new Date(task.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {myTasks.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">You haven't posted any tasks yet.</p>
                  <Button 
                    onClick={() => setCreateModalOpen(true)} 
                    className="mt-4"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Task
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateTaskModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen}
        onTaskCreated={() => {
          fetchMyTasks();
          setCreateModalOpen(false);
        }}
      />
    </div>
  );
};

export default Dashboard;