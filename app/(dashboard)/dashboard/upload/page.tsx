import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { UploadReceiptForm } from "./upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Escanear Nota</h1>
        <p className="text-gray-600 mt-2">
          Envie a imagem e a Notia chama o backend para processar e persistir os dados.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notia Scanner</CardTitle>
          <CardDescription>
            Server Action gateway para `POST /process`
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 rounded-lg border-2 border-dashed border-gray-300 p-6">
            <div className="text-center">
              <Upload className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-muted-foreground">
                O frontend não chama o backend diretamente; o envio passa por uma server action.
              </p>
            </div>
            <UploadReceiptForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
