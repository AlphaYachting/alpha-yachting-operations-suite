# AFTER SNAPSHOT: pages/OfferDetail (Header Section)
Date: 2026-02-08
Purpose: Header structure after visual reordering

## New Structure (Lines 645-724)

```jsx
{/* Header */}
<div className="space-y-4">
  {/* Row 1: Action Buttons */}
  <div className="flex items-center justify-between">
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate(createPageUrl('Offers'))}
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
    <div className="flex gap-2">
      {formData.customer_id && formData.title && (
        <PDFExportButton 
          document={getPDFDocument()}
          lineItems={getPDFLineItems()}
        />
      )}
      {formData.converted_job_id ? (
        <Button
          onClick={() => navigate(createPageUrl('JobDetail') + `?id=${formData.converted_job_id}`)}
          variant="outline"
          className="border-green-600 text-green-600 hover:bg-green-50"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          View Project
        </Button>
      ) : (
        formData.status === 'Approved' && !formData.converted_work_order_id && (
          <Button
            onClick={() => setShowCreateProjectDialog(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        )
      )}
      {formData.status === 'Approved' && !formData.converted_work_order_id && formData.job_id && !formData.converted_job_id && (
        <Button
          onClick={() => setShowConvertDialog(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <FileText className="h-4 w-4 mr-2" />
          Convert to Work Order
        </Button>
      )}
      {(offerId || tasks.length > 0) && (
        <Button
          onClick={handleSaveAsTemplate}
          disabled={saving}
          variant="outline"
          className="border-purple-600 text-purple-600 hover:bg-purple-50"
        >
          Save as Template
        </Button>
      )}
      <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
        <Save className="h-4 w-4 mr-2" />
        {saving ? 'Saving...' : 'Save Offer'}
      </Button>
    </div>
  </div>
  
  {/* Row 2: Title */}
  <h1 className="text-3xl font-bold text-slate-900">
    {isNewOffer ? 'New Offer' : formData.title}
  </h1>
  
  {/* Row 3: Meta Info */}
  {!isNewOffer && (
    <div className="flex items-center gap-3">
      {formData.offer_number && (
        <p className="text-slate-600">#{formData.offer_number}</p>
      )}
      <Badge className={
        formData.status === 'Approved' ? 'bg-green-100 text-green-700' :
        formData.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
        'bg-slate-100 text-slate-700'
      }>
        {formData.status}
      </Badge>
    </div>
  )}
</div>
```

## New Layout:
- Vertical stack (space-y-4)
- Row 1: Back button (left) | Action buttons (right)
- Row 2: Title (full width)
- Row 3: Offer number + Status badge (horizontal group)