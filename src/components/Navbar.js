// src/components/Navbar.tsx
import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CartContext } from '../contexts/CartContext';

const Navbar = (props) => {
  const [menuOpen, setMenuOpen] = useState(false);
  // Use navigation from props (passed by the header) or fall back to the hook.
  const hookNavigation = useNavigation();
  const navigation = props.navigation || hookNavigation;
  const { count } = useContext(CartContext);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const goAndClose = (route) => {
    setMenuOpen(false);
    navigation.navigate(route);
  };

  const handleAllClick = () => {
    setMenuOpen(false);
    navigation.navigate('Home');
  };

  return (
    <View style={styles.navbar}>
      <View style={styles.navbarContainer}>
        {/* Hamburger Menu */}
        <TouchableOpacity onPress={toggleMenu} style={styles.hamburgerMenu}>
          <View style={[styles.bar, menuOpen && styles.barOpen1]} />
          <View style={[styles.bar, menuOpen && styles.barOpen2]} />
        </TouchableOpacity>

        {/* Logo & Brand */}
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.logoBrand}>
          <Image
            source={require('../../Assets/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brand}>Huastex</Text>
        </TouchableOpacity>

        {/* Cart Icon */}
        <TouchableOpacity onPress={() => navigation.navigate('MyOrders')} style={styles.cartIcon}>
          <Image
            source={require('../../Assets/cart.png')}
            style={styles.shoppingCart}
          />
          {count > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{count}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Conditionally render menu items */}
      {menuOpen && (
        <View style={styles.menu}>
          <TouchableOpacity onPress={handleAllClick}>
            <Text style={styles.menuItem}>Principal</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goAndClose('Shop')}>
            <Text style={styles.menuItem}>Tienda</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goAndClose('Categories')}>
            <Text style={styles.menuItem}>Categorías</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goAndClose('MyOrders')}>
            <Text style={styles.menuItem}>Carrito</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goAndClose('User')}>
            <Text style={styles.menuItem}>Mi Cuenta</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goAndClose('Us')}>
            <Text style={styles.menuItem}>Nosotros</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  navbar: {
    backgroundColor: '#fff',
    marginTop: 0,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  navbarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hamburgerMenu: {
    padding: 10,
  },
  bar: {
    width: 35,
    height: 3,
    backgroundColor: '#000',
    marginVertical: 2,
  },
  barOpen1: {
    transform: [ { rotate: '45deg'}, { translateX: 2 }, { translateY: 2 } ],
  },
  barOpen2: {
    transform: [{ rotate: '-45deg' }, { translateX: 2 }, { translateY: -2 } ],
  },
  logoBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  brand: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cartIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shoppingCart: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1486AC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  menu: {
    marginTop: 10,
  },
  menuItem: {
    fontSize: 18,
    paddingVertical: 10,
  },
});

export default Navbar;


//+++++++++++ USING CONTEXT

// import React, { useState, useContext } from 'react';
// import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// // import { ShoppingCartContext } from '../../Context'; // adjust path if needed

// const Navbar = () => {
// //   const { cartProducts, setSearchByCategory } = useContext(ShoppingCartContext);
// // const { cartProducts, setSearchByCategory } = useContext(ShoppingCartContext);
//   const [menuOpen, setMenuOpen] = useState(false);
//   const navigation = useNavigation();

//   const toggleMenu = () => setMenuOpen(!menuOpen);

//   const handleAllClick = () => {
//     setSearchByCategory('');
//     setMenuOpen(false);
//     navigation.navigate('Home');
//   };

//   return (
//     <View style={styles.navbar}>
//       <View style={styles.navbarContainer}>
//         {/* Hamburger Menu */}
//         <TouchableOpacity onPress={toggleMenu} style={styles.hamburgerMenu}>
//           <View style={[styles.bar, menuOpen && styles.barOpen1]} />
//           <View style={[styles.bar, menuOpen && styles.barOpen2]} />
//         </TouchableOpacity>

//         {/* Logo & Brand */}
//         <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.logoBrand}>
//           <Image
//             source={require('../../Assets/logo.png')}
//             style={styles.logo}
//           />
//           <Text style={styles.brand}>Huastex</Text>
//         </TouchableOpacity>

//         {/* Cart Icon */}
//         <TouchableOpacity onPress={() => navigation.navigate('MyOrders')} style={styles.cartIcon}>
//           <Image
//             source={require('../../Assets/cart.png')}
//             style={styles.shoppingCart}
//           />
//           <Text>{cartProducts?.length || 0}</Text>
//         </TouchableOpacity>
//       </View>

//       {/* Conditionally render menu items */}
//       {menuOpen && (
//         <View style={styles.menu}>
//           <TouchableOpacity onPress={handleAllClick}>
//             <Text style={styles.menuItem}>Principal</Text>
//           </TouchableOpacity>
//           <TouchableOpacity onPress={() => { toggleMenu(); navigation.navigate('Electronics'); }}>
//             <Text style={styles.menuItem}>Electrónica</Text>
//           </TouchableOpacity>
//           <TouchableOpacity onPress={() => { toggleMenu(); navigation.navigate('MyOrders'); }}>
//             <Text style={styles.menuItem}>Carrito</Text>
//           </TouchableOpacity>
//           <TouchableOpacity onPress={() => { toggleMenu(); navigation.navigate('User'); }}>
//             <Text style={styles.menuItem}>Mi Cuenta</Text>
//           </TouchableOpacity>
//           <TouchableOpacity onPress={() => { toggleMenu(); navigation.navigate('Contact'); }}>
//             <Text style={styles.menuItem}>Contacto</Text>
//           </TouchableOpacity>
//           <TouchableOpacity onPress={() => { toggleMenu(); navigation.navigate('Us'); }}>
//             <Text style={styles.menuItem}>Nosotros</Text>
//           </TouchableOpacity>
//         </View>
//       )}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   navbar: {
//     backgroundColor: '#fff',
//     paddingTop: 20, // Adjust for status bar if necessary
//     paddingHorizontal: 16,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.1,
//     shadowRadius: 6,
//     elevation: 5,
//   },
//   navbarContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   hamburgerMenu: {
//     padding: 10,
//   },
//   bar: {
//     width: 35,
//     height: 3,
//     backgroundColor: '#000',
//     marginVertical: 2,
//   },
//   barOpen1: {
//     transform: [{ rotate: '45deg' }],
//   },
//   barOpen2: {
//     transform: [{ rotate: '-45deg' }],
//   },
//   logoBrand: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   logo: {
//     width: 40,
//     height: 40,
//     resizeMode: 'contain',
//   },
//   brand: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     marginLeft: 8,
//   },
//   cartIcon: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   shoppingCart: {
//     width: 40,
//     height: 40,
//     resizeMode: 'contain',
//   },
//   menu: {
//     marginTop: 10,
//   },
//   menuItem: {
//     fontSize: 18,
//     paddingVertical: 10,
//   },
// });

// export default Navbar;
