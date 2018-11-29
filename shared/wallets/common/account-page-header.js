// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

// Component to show page title on desktop
// And account name / title like this on mobile:
//    account-name
//       title
// To be used as customComponent in HeaderHoc

type Props = {
  accountName?: string,
  title: string,
}

const AccountPageHeader = (props: Props) => (
  <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.container}>
    <Kb.Box2 direction="vertical">
      {Styles.isMobile && !!props.accountName && (
        <Kb.Text type="BodySmallSemibold" style={styles.textAlignCenter}>
          {props.accountName}
        </Kb.Text>
      )}
      <Kb.Text type="BodyBig" style={styles.textAlignCenter}>
        {props.title}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.fillAbsolute,
    flex: 1,
  },
  textAlignCenter: {
    textAlign: 'center',
  },
})

export default AccountPageHeader
