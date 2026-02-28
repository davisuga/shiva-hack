import { Receipt } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>

      <div className="hidden lg:flex bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 items-center justify-center p-8">
        <div className="text-white max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
              <Receipt className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold">Notia</h1>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">
              Turn receipts into savings insights
            </h2>
            <p className="text-white/90 text-lg">
              Stop losing money on retail purchases. Upload your receipts and discover 
              which products you should be buying in bulk.
            </p>
            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg mt-1">
                  <span className="text-sm font-bold">📸</span>
                </div>
                <div>
                  <h3 className="font-semibold">AI-Powered Extraction</h3>
                  <p className="text-white/80 text-sm">
                    Snap a photo, get instant analysis in any language
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg mt-1">
                  <span className="text-sm font-bold">💰</span>
                </div>
                <div>
                  <h3 className="font-semibold">Smart Savings</h3>
                  <p className="text-white/80 text-sm">
                    Discover bulk buying opportunities and track ROI
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg mt-1">
                  <span className="text-sm font-bold">🌍</span>
                </div>
                <div>
                  <h3 className="font-semibold">Global Support</h3>
                  <p className="text-white/80 text-sm">
                    Works with receipts from anywhere in the world
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
