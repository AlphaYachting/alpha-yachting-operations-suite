import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Image as ImageIcon, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  X,
  Pencil,
  Trash2,
  Download
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const categoryColors = {
  Before: 'bg-blue-100 text-blue-700',
  During: 'bg-amber-100 text-amber-700',
  After: 'bg-green-100 text-green-700',
  Damage: 'bg-red-100 text-red-700',
  Expenses: 'bg-purple-100 text-purple-700',
  Other: 'bg-slate-100 text-slate-700'
};

export default function PhotoGallery({ photos, tasks, onPhotoDeleted, onPhotoUpdated }) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deletingPhoto, setDeletingPhoto] = useState(null);

  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => 
      categoryFilter === 'all' || photo.category === categoryFilter
    );
  }, [photos, categoryFilter]);

  const currentPhoto = filteredPhotos[currentIndex];

  const openViewer = (index) => {
    setCurrentIndex(index);
    setViewerOpen(true);
  };

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % filteredPhotos.length);
  };

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  const handleDelete = async () => {
    if (!deletingPhoto) return;
    try {
      await base44.entities.WorkOrderPhoto.delete(deletingPhoto.id);
      toast.success('Photo deleted');
      onPhotoDeleted?.();
      setDeletingPhoto(null);
      if (viewerOpen && filteredPhotos.length === 1) {
        setViewerOpen(false);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  const getTaskTitle = (taskId) => {
    if (!taskId) return null;
    const task = tasks.find(t => t.id === taskId);
    return task?.title;
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <ImageIcon className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p className="text-lg font-medium">No photos yet</p>
        <p className="text-sm mt-1">Upload photos to document your work</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Before">Before</SelectItem>
              <SelectItem value="During">During</SelectItem>
              <SelectItem value="After">After</SelectItem>
              <SelectItem value="Damage">Damage</SelectItem>
              <SelectItem value="Expenses">Expenses</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500">
            {filteredPhotos.length} photo{filteredPhotos.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredPhotos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => openViewer(index)}
              className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 transition-all group"
            >
              <img
                src={photo.thumb_url || photo.file_url}
                alt={photo.caption || 'Work order photo'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />
              <Badge 
                className={`absolute top-2 left-2 text-xs ${categoryColors[photo.category]}`}
              >
                {photo.category}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox Viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 bg-black">
          <div className="relative h-[95vh] flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={categoryColors[currentPhoto?.category]}>
                      {currentPhoto?.category}
                    </Badge>
                    {currentPhoto?.task_id && (
                      <Badge variant="outline" className="text-white border-white/30">
                        {getTaskTitle(currentPhoto.task_id)}
                      </Badge>
                    )}
                  </div>
                  {currentPhoto?.caption && (
                    <p className="text-sm">{currentPhoto.caption}</p>
                  )}
                  <p className="text-xs text-white/70 mt-1">
                    {format(parseISO(currentPhoto?.created_date), 'MMM d, yyyy h:mm a')} • 
                    {(currentPhoto?.file_size_bytes / 1024).toFixed(0)} KB • 
                    {currentPhoto?.width} × {currentPhoto?.height}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewerOpen(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Image */}
            <div className="flex-1 flex items-center justify-center p-16">
              {currentPhoto && (
                <img
                  src={currentPhoto.file_url}
                  alt={currentPhoto.caption || 'Work order photo'}
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>

            {/* Navigation */}
            {filteredPhotos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center justify-between gap-4">
                <span className="text-white text-sm">
                  {currentIndex + 1} / {filteredPhotos.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(currentPhoto?.file_url, '_blank')}
                    className="text-white hover:bg-white/20"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingPhoto(currentPhoto)}
                    className="text-white hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPhoto} onOpenChange={(open) => !open && setDeletingPhoto(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this photo. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}