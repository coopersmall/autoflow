import { Flex } from '@radix-ui/themes';

export function LogoIcon() {
  return (
    <Flex
      data-aid="logo"
      style={{
        backgroundImage: 'url(/images/logo.svg)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        filter: 'invert(100%)',
        height: '36px',
        width: '36px',
      }}
    />
  );
}
