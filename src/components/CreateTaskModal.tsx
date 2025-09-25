import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const taskSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(100, 'Title must be less than 100 characters'),
  description: z.string().trim().max(500, 'Description must be less than 500 characters').optional(),
  price: z.number().min(10, 'Price must be at least ₹10').max(10000, 'Price must be less than ₹10,000'),
  deadline: z.string().optional(),
});

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ open, onOpenChange, onTaskCreated }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    deadline: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    
    try {
      const validatedData = taskSchema.parse({
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        deadline: formData.deadline || undefined,
      });

      const taskData = {
        poster_id: user.id,
        title: validatedData.title,
        description: validatedData.description,
        price: validatedData.price,
        deadline: validatedData.deadline ? new Date(validatedData.deadline).toISOString() : null,
        status: 'open',
      };

      const { error } = await supabase
        .from('tasks')
        .insert(taskData);

      if (error) throw error;

      toast({
        title: 'Task Created!',
        description: 'Your task has been posted successfully.',
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        price: '',
        deadline: '',
      });

      onTaskCreated();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.issues[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create task. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Post a task for fellow students to help you with.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Print & bind report"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Provide more details about the task..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price (₹) *</Label>
            <Input
              id="price"
              type="number"
              placeholder="50"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
              min="10"
              max="10000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (optional)</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskModal;