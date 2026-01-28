import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft,
  Ship,
  MapPin,
  Ruler,
  Settings,
  User,
  Edit,
  Image as ImageIcon,
  Upload,
  X,
  Briefcase,
  Calendar,
  FileText,
  Navigation
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import BoatDocuments from '@/components/boats/BoatDocuments';

export default function BoatDetail() {
  const [searchParams] = useSearchParams();
  const boatId = searchParams.get('id');
  
  const [boat, setBoat] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [location, setLocation] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (boatId) {
      loadBoatData();
    } else {
      setLoading(false);
    }
  }, [boatId]);

  const loadBoatData = async () => {
    try {
      const [boatData, jobsData] = await Promise.all([
        base44.entities.Boat.filter({ id: boatId }),
        base44.entities.Job.filter({ boat_id: boatId })
      ]);

      if (boatData.length === 0) {
        setLoading(false);
        return;
      }

      const boatRecord = boatData[0];
      setBoat(boatRecord);
      setJobs(jobsData);

      if (boatRecord.customer_id) {
        const customerData = await base44.entities.Customer.filter({ id: boatRecord.customer_id });
        if (customerData.length > 0) setCustomer(customerData[0]);
      }

      if (boatRecord.current_location_id) {
        const locationData = await base44.entities.Location.filter({ id: boatRecord.current_location_id });
        if (locationData.length > 0) setLocation(locationData[0]);
      }
    } catch (error) {
      console.error('Error loading boat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e, isPrimary = true) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (isPrimary) {
        await base44.entities.Boat.update(boat.id, { photo_url: file_url });
        setBoat({ ...boat, photo_url: file_url });
      } else {
        const newImages = [...(boat.images || []), file_url];
        await base44.entities.Boat.update(boat.id, { images: newImages });
        setBoat({ ...boat, images: newImages });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async (imageUrl, isPrimary = false) => {
    if (!confirm('Remove this image?')) return;

    try {
      if (isPrimary) {
        await base44.entities.Boat.update(boat.id, { photo_url: '' });
        setBoat({ ...boat, photo_url: '' });
      } else {
        const newImages = boat.images.filter(img => img !== imageUrl);
        await base44.entities.Boat.update(boat.id, { images: newImages });
        setBoat({ ...boat, images: newImages });
      }
    } catch (error) {
      console.error('Error removing image:', error);
    }
  };

  const handleSetPrimary = async (imageUrl) => {
    try {
      const oldPrimary = boat.photo_url;
      const newImages = boat.images.filter(img => img !== imageUrl);
      if (oldPrimary) newImages.push(oldPrimary);
      
      await base44.entities.Boat.update(boat.id, { 
        photo_url: imageUrl,
        images: newImages
      });
      setBoat({ ...boat, photo_url: imageUrl, images: newImages });
    } catch (error) {
      console.error('Error setting primary image:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!boat) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost">
          <Link to={createPageUrl('Boats')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Boats
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            Boat not found. It may have been deleted or the ID is incorrect.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getCustomerName = () => {
    if (!customer) return 'Unknown';
    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  const openMapsRoute = () => {
    if (!location?.latitude || !location?.longitude) return;
    
    const lat = location.latitude;
    const lng = location.longitude;
    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    
    window.open(mapUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to={createPageUrl('Boats')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{boat.vessel_name}</h1>
            {customer && (
              <Link 
                to={createPageUrl('CustomerDetail') + `?id=${customer.id}`}
                className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1 mt-1"
              >
                <User className="h-3.5 w-3.5" />
                {getCustomerName()}
              </Link>
            )}
          </div>
        </div>
        <Button asChild>
          <Link to={createPageUrl('Boats') + `?edit=${boat.id}`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Boat
          </Link>
        </Button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="history">Service History ({jobs.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Primary Image */}
          {boat.photo_url && (
            <Card>
              <CardContent className="p-0">
                <img 
                  src={boat.photo_url} 
                  alt={boat.vessel_name}
                  className="w-full h-64 object-cover rounded-t-lg cursor-pointer"
                  onClick={() => { setSelectedImage(boat.photo_url); setShowImageDialog(true); }}
                />
              </CardContent>
            </Card>
          )}

          {/* Boat Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vessel Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Type</p>
                    <p className="font-medium">{boat.vessel_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Status</p>
                    <Badge>{boat.status}</Badge>
                  </div>
                </div>
                {boat.manufacturer && (
                  <div>
                    <p className="text-sm text-slate-500">Manufacturer</p>
                    <p className="font-medium">{boat.manufacturer}</p>
                  </div>
                )}
                {boat.model && (
                  <div>
                    <p className="text-sm text-slate-500">Model</p>
                    <p className="font-medium">{boat.model}</p>
                  </div>
                )}
                {boat.year && (
                  <div>
                    <p className="text-sm text-slate-500">Year</p>
                    <p className="font-medium">{boat.year}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dimensions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {boat.length_m && (
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500">Length:</span>
                    <span className="font-medium">{boat.length_m}m</span>
                  </div>
                )}
                {boat.beam_m && (
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500">Beam:</span>
                    <span className="font-medium">{boat.beam_m}m</span>
                  </div>
                )}
                {boat.draft_m && (
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500">Draft:</span>
                    <span className="font-medium">{boat.draft_m}m</span>
                  </div>
                )}
                {boat.hull_material && (
                  <div>
                    <p className="text-sm text-slate-500">Hull Material</p>
                    <p className="font-medium">{boat.hull_material}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Engine & Systems</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {boat.engine_type && (
                  <div>
                    <p className="text-sm text-slate-500">Engine Type</p>
                    <p className="font-medium">{boat.engine_type}</p>
                  </div>
                )}
                {boat.engine_manufacturer && (
                  <div>
                    <p className="text-sm text-slate-500">Engine Make</p>
                    <p className="font-medium">{boat.engine_manufacturer} {boat.engine_model}</p>
                  </div>
                )}
                {boat.engine_number && (
                  <div>
                    <p className="text-sm text-slate-500">Engine Number</p>
                    <p className="font-medium">{boat.engine_number}</p>
                  </div>
                )}
                {boat.engine_hours !== null && boat.engine_hours !== undefined && (
                  <div>
                    <p className="text-sm text-slate-500">Engine Hours</p>
                    <p className="font-medium">{boat.engine_hours}h</p>
                  </div>
                )}
                {boat.electrical_system && (
                  <div>
                    <p className="text-sm text-slate-500">Electrical System</p>
                    <p className="font-medium">{boat.electrical_system}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {location && (
                  <button
                    onClick={openMapsRoute}
                    disabled={!location.latitude || !location.longitude}
                    className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 disabled:bg-slate-50 disabled:cursor-not-allowed transition-colors w-full"
                  >
                    <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="font-medium text-blue-600 flex-1 text-left">{location.name}</span>
                    <Navigation className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  </button>
                )}
                {boat.berth_number && (
                  <div>
                    <p className="text-sm text-slate-500">Berth</p>
                    <p className="font-medium">{boat.berth_number}</p>
                  </div>
                )}
                {boat.access_details && (
                  <div>
                    <p className="text-sm text-slate-500">Access Details</p>
                    <p className="text-sm">{boat.access_details}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {(boat.known_issues || boat.systems_notes) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {boat.known_issues && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Known Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{boat.known_issues}</p>
                  </CardContent>
                </Card>
              )}
              {boat.systems_notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Systems Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{boat.systems_notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          {user && <BoatDocuments boatId={boatId} userRole={user.role} />}
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-6">
          {/* Primary Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Primary Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {boat.photo_url ? (
                <div className="relative group">
                  <img 
                    src={boat.photo_url} 
                    alt="Primary"
                    className="w-full h-96 object-cover rounded-lg cursor-pointer"
                    onClick={() => { setSelectedImage(boat.photo_url); setShowImageDialog(true); }}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemoveImage(boat.photo_url, true)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-12 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-500">No primary image</p>
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, true)}
                  className="hidden"
                  id="primary-image-upload"
                  disabled={uploadingImage}
                />
                <label htmlFor="primary-image-upload">
                  <Button asChild disabled={uploadingImage}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {boat.photo_url ? 'Replace' : 'Upload'} Primary Image
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Gallery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {boat.images && boat.images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {boat.images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={img} 
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-40 object-cover rounded-lg cursor-pointer"
                        onClick={() => { setSelectedImage(img); setShowImageDialog(true); }}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSetPrimary(img)}
                        >
                          Set Primary
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveImage(img, false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No additional images</p>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, false)}
                  className="hidden"
                  id="gallery-image-upload"
                  disabled={uploadingImage}
                />
                <label htmlFor="gallery-image-upload">
                  <Button asChild disabled={uploadingImage}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Add Image to Gallery
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Service History Tab */}
        <TabsContent value="history" className="space-y-4">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No service history yet</p>
              </CardContent>
            </Card>
          ) : (
            jobs.map(job => (
              <Card key={job.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link 
                        to={createPageUrl('JobDetail') + `?id=${job.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600"
                      >
                        {job.title}
                      </Link>
                      <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {job.created_date && format(new Date(job.created_date), 'MMM d, yyyy')}
                        </div>
                        <Badge>{job.status}</Badge>
                        {job.priority && job.priority !== 'Normal' && (
                          <Badge variant="outline">{job.priority}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Image Preview Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img src={selectedImage} alt="Preview" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}