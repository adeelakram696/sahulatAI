import LocationEditor from '@/components/location/location-editor'

export default function LocationOnboardingPage() {
  return (
    <div className="flex flex-col items-center min-h-screen p-4 pt-12 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Where are you located?</h1>
          <p className="text-muted-foreground text-sm">
            Add your first location so we can find the best service providers near you.
          </p>
        </div>

        <div className="p-4 border rounded-lg shadow-sm bg-card">
          <LocationEditor isFirstLocation={true} />
        </div>
      </div>
    </div>
  )
}
