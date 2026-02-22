import RoomClient from './ui/RoomClient';

export default async function RoomPage(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  return (
    <main>
      <RoomClient code={code.toUpperCase()} />
    </main>
  );
}
