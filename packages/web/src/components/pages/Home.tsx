'use client';

import { Flex } from '@radix-ui/themes';
import { DefaultLayout } from '@web/components/layout/DefaultLayout';
import { APITester } from '@web/components/ui/APITester';
import { LeftButtons } from '@web/components/ui/left-menu/buttons/LeftMenuButtons';
import { LeftMenu } from '@web/components/ui/left-menu/LeftMenu';
import { TopMenu } from '@web/components/ui/top-menu/TopMenu';
import { TopLeftMenu } from '@web/components/ui/top-menu/top-left-menu/TopLeftMenu';
import { ChatButton } from '@web/components/ui/top-menu/top-right-menu/buttons/ChatMenuButton';
import { TopRightMenu } from '@web/components/ui/top-menu/top-right-menu/TopRightMenu';
import styled from 'styled-components';

export default function Home() {
  const leftMenuButtons = <LeftButtons />;

  const topLeftMenuContent = <TopLeftMenu />;

  const chatButton = <ChatButton onClick={() => null} />;
  const topRightMenuContent = <APITester />;
  const topRightMenu = (
    <TopRightMenu buttons={[chatButton]} content={topRightMenuContent} />
  );

  return (
    <DefaultLayout>
      <StyledMain>
        <LeftMenu topButtons={leftMenuButtons}></LeftMenu>

        <StyledContentContainer>
          <Flex
            style={{
              height: '52px',
              width: '100%',
            }}
          >
            <TopMenu
              leftContent={topLeftMenuContent}
              rightContent={topRightMenu}
            />
          </Flex>
          <StyledMiddleSection>
            <StyledMiddleContent></StyledMiddleContent>
          </StyledMiddleSection>
        </StyledContentContainer>
      </StyledMain>
    </DefaultLayout>
  );
}

const StyledMain = styled.main`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin-right: 20px;
  height: 95vh;
  width: 100%;
`;

const StyledContentContainer = styled(Flex)`
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding-right: 2rem; /* Adjust as needed */
`;

const StyledMiddleSection = styled(Flex)`
  flex-direction: column;
  justify-content: flex-end;
  height: 90%;
`;

const StyledMiddleContent = styled(Flex)`
  flex-direction: row;
  height: 100%;
  width: 100%;
`;
