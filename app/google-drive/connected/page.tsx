import GoogleDriveConnectedClient from "./page-client";

type GoogleDriveConnectedPageProps = {
  searchParams: Promise<{
    success?: string | string[];
    error?: string | string[];
  }>;
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GoogleDriveConnectedPage({
  searchParams,
}: GoogleDriveConnectedPageProps) {
  const params = await searchParams;

  return (
    <GoogleDriveConnectedClient
      error={getSingleValue(params.error)}
      success={getSingleValue(params.success)}
    />
  );
}
